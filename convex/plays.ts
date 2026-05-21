import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Start a play session (consumes one play from the ticket)
export const startPlay = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.playsRemaining <= 0 || ticket.status === "exhausted") {
      throw new Error("No plays remaining on this ticket");
    }

    // Decrement plays remaining
    const newPlaysRemaining = ticket.playsRemaining - 1;
    await ctx.db.patch(args.ticketId, {
      playsRemaining: newPlaysRemaining,
      status: newPlaysRemaining <= 0 ? "exhausted" : "active",
    });

    // Create the play record
    const playId = await ctx.db.insert("plays", {
      ticketId: args.ticketId,
      startedAt: Date.now(),
      status: "active",
    });

    return playId;
  },
});

// Submit score for a play session with duration-based anti-cheat validation
export const submitScore = mutation({
  args: {
    playId: v.id("plays"),
    score: v.number(),
    playerName: v.string(),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { playId, score, playerName, country } = args;
    
    // Fetch play details
    const play = await ctx.db.get(playId);
    if (!play) {
      throw new Error("Play session not found");
    }

    if (play.status !== "active") {
      throw new Error("Score already submitted or session inactive");
    }

    // Fetch associated ticket to get player email
    const ticket = await ctx.db.get(play.ticketId);
    if (!ticket) {
      throw new Error("Associated ticket not found");
    }

    const now = Date.now();
    const durationMs = now - play.startedAt;
    
    // ANTI-CHEAT VALIDATION
    // Flappy bird speed is constant. In our game, the gap between obstacles 
    // will take approx 1.6 seconds to reach.
    // Near misses grant an additional point, meaning max score per gate is 2.
    // Minimum time required for score S is (S * 0.75) seconds.
    // We allow a small buffer for the initial launch (e.g. 1.0 second).
    const minRequiredTimeMs = score > 0 ? (score * 750) - 1000 : 0;

    if (durationMs < minRequiredTimeMs) {
      // Reject score
      await ctx.db.patch(playId, {
        completedAt: now,
        score,
        status: "rejected",
      });
      throw new Error(`Score validation failed. Play duration of ${Math.round(durationMs/1000)}s is too short for a score of ${score}.`);
    }

    // Update play status
    await ctx.db.patch(playId, {
      completedAt: now,
      score,
      status: "verified",
    });

    // Post score to the leaderboard (every play gets posted)
    const email = ticket.email;
    await ctx.db.insert("leaderboard", {
      playerName: playerName.trim() || "Anonymous",
      email,
      score,
      timestamp: now,
      playId,
      ...(country !== undefined ? { country } : {}),
    });

    return { verified: true, score };
  },
});

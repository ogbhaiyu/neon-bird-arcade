import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Retrieve the top entries on the leaderboard, ordered by score descending
export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("leaderboard")
      .withIndex("by_score")
      .order("desc")
      .take(50); // limit to top 50
  },
});

// Retrieve the list of past winners
export const getRecentWinners = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("winners")
      .withIndex("by_date")
      .order("desc")
      .take(10); // limit to last 10 winners
  },
});

// Archive round winner and reset leaderboard (called by cron every 2 hours)
export const archiveLeaderboardAndReset = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch the highest score from the leaderboard
    const leader = await ctx.db
      .query("leaderboard")
      .withIndex("by_score")
      .order("desc")
      .first();

    const now = new Date();
    // Round to nearest 2-hour UTC block boundary
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const nearestBlockTime = new Date(Math.round(now.getTime() / twoHoursMs) * twoHoursMs);
    
    const datePart = nearestBlockTime.toISOString().split("T")[0];
    const hourPart = nearestBlockTime.getUTCHours().toString().padStart(2, "0");
    const dateStr = `${datePart} ${hourPart}:00 UTC`;

    if (leader) {
      // 2. Insert winner entry (for $10 manual payout tracking)
      await ctx.db.insert("winners", {
        date: dateStr,
        playerName: leader.playerName,
        email: leader.email,
        score: leader.score,
        payoutAmount: 10, // $10 guaranteed reward
        paid: false,
      });
    }

    // 3. Delete all entries in the active leaderboard
    const leaderboardEntries = await ctx.db.query("leaderboard").collect();
    for (const entry of leaderboardEntries) {
      await ctx.db.delete(entry._id);
    }

    // 4. Return winner details
    return leader
      ? { winner: leader.playerName, email: leader.email, score: leader.score }
      : null;
  },
});

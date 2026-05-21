import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get ticket details for a given email address
export const getAllTickets = query({
  handler: async (ctx) => {
    return await ctx.db.query("tickets").collect();
  },
});

// Get ticket details for a given email address
export const getActiveTicket = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    
    // Find all tickets for this email
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .collect();

    // Filter to find active tickets with plays remaining
    const activeTickets = tickets.filter(
      (t) => t.status === "active" && t.playsRemaining > 0
    );

    if (activeTickets.length === 0) {
      // If there are no active tickets, return the latest one if any exists
      if (tickets.length > 0) {
        const sorted = [...tickets].sort((a, b) => b.createdAt - a.createdAt);
        return {
          ...sorted[0],
          status: "exhausted",
          playsRemaining: 0,
        };
      }
      return null;
    }

    // Sort active tickets by createdAt ascending (oldest first) to consume oldest first
    const sortedActive = [...activeTickets].sort((a, b) => a.createdAt - b.createdAt);
    const oldestActive = sortedActive[0];

    // Sum all plays remaining
    const totalPlaysRemaining = activeTickets.reduce((sum, t) => sum + t.playsRemaining, 0);

    return {
      ...oldestActive,
      playsRemaining: totalPlaysRemaining,
    };
  },
});

// Create a new game ticket, called by the webhook (Gumroad or Dev sandbox simulator)
export const createTicketFromWebhook = mutation({
  args: {
    email: v.string(),
    purchaseId: v.string(),
    plays: v.number(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    // Check if we already created a ticket for this purchaseId to prevent double-crediting
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .collect();

    const alreadyProcessed = tickets.find((t) => t.purchaseId === args.purchaseId);
    if (alreadyProcessed) {
      return alreadyProcessed._id;
    }

    // Create the ticket
    const ticketId = await ctx.db.insert("tickets", {
      email: cleanEmail,
      purchaseId: args.purchaseId,
      playsRemaining: args.plays,
      createdAt: Date.now(),
      status: "active",
    });

    return ticketId;
  },
});

// Create a new game ticket from validated license key
export const createTicketFromLicense = mutation({
  args: {
    email: v.string(),
    purchaseId: v.string(),
    licenseKey: v.string(),
    plays: v.number(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const cleanLicense = args.licenseKey.trim().toUpperCase();

    // 1. Verify this license key hasn't been claimed globally by ANY email
    const existingByLicense = await ctx.db
      .query("tickets")
      .withIndex("by_license", (q) => q.eq("licenseKey", cleanLicense))
      .first();

    if (existingByLicense) {
      if (existingByLicense.email === cleanEmail) {
        // Already claimed by this user - return existing ticket ID
        return existingByLicense._id;
      }
      // Claimed by someone else!
      throw new Error("This license key has already been activated by another email address.");
    }

    // 2. Double check if this purchaseId was already claimed by this email
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .collect();

    const alreadyProcessed = tickets.find((t) => t.purchaseId === args.purchaseId);
    if (alreadyProcessed) {
      return alreadyProcessed._id;
    }

    // 3. Create the ticket
    const ticketId = await ctx.db.insert("tickets", {
      email: cleanEmail,
      purchaseId: args.purchaseId,
      licenseKey: cleanLicense,
      playsRemaining: args.plays,
      createdAt: Date.now(),
      status: "active",
    });

    return ticketId;
  },
});

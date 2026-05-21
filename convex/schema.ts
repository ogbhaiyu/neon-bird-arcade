import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tickets: defineTable({
    email: v.string(),
    purchaseId: v.string(), // Gumroad sale_id or dev-simulation ID
    playsRemaining: v.number(), // Starts at e.g., 3
    createdAt: v.number(),
    status: v.string(), // "active" | "exhausted"
    licenseKey: v.optional(v.string()), // Gumroad license key used for activation
  })
    .index("by_email", ["email"])
    .index("by_license", ["licenseKey"]),

  plays: defineTable({
    ticketId: v.id("tickets"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    status: v.string(), // "active" | "verified" | "rejected"
  }),

  leaderboard: defineTable({
    playerName: v.string(),
    email: v.string(),
    score: v.number(),
    timestamp: v.number(),
    playId: v.id("plays"),
    country: v.optional(v.string()),
  })
    .index("by_score", ["score"]),

  winners: defineTable({
    date: v.string(), // "YYYY-MM-DD"
    playerName: v.string(),
    email: v.string(),
    score: v.number(),
    payoutAmount: v.number(), // e.g. 10
    paid: v.boolean(),
    paidAt: v.optional(v.number()),
  })
    .index("by_date", ["date"]),
});

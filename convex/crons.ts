import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Schedule the 2-hour reset
crons.cron(
  "jackpot-leaderboard-reset",
  "0 */2 * * *", // Reset every 2 hours
  api.leaderboard.archiveLeaderboardAndReset,
);

export default crons;

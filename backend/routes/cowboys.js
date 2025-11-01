import { Router } from "express";
import {
  fetchCowboysGamesSeasonToDate,
  computeRecordFromGames,
} from "../services/espn.js";

const router = Router();

/**
 * GET Cowboys performance overview
 * - Record (W-L-T)
 * - Win percentage
 * - Offensive rating (avg points scored per game)
 * - Defensive rating (avg points allowed per game)
 */
router.get("/", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    // Fetch all completed + live Cowboys games
    const games = await fetchCowboysGamesSeasonToDate(year);

    if (!games || games.length === 0) {
      return res.json({
        record: "0-0-0",
        winPercentage: 0.0,
        offensiveRating: 0.0,
        defensiveRating: 0.0,
      });
    }

    // Compute record (from helper)
    const record = computeRecordFromGames(games);

    // Compute points for and against
    let totalPointsFor = 0;
    let totalPointsAgainst = 0;

    for (const g of games) {
      // Normalize team identifiers from ESPN API
      const homeAbbr = g.homeTeam?.abbreviation || g.homeTeam?.shortName || "";
      const awayAbbr = g.awayTeam?.abbreviation || g.awayTeam?.shortName || "";

      const isCowboysHome =
        homeAbbr === "DAL" || g.homeTeam?.displayName?.includes("Cowboys");

      const cowboysScore = isCowboysHome
        ? g.homeScore ?? g.homeTeamScore ?? g.home?.score ?? 0
        : g.awayScore ?? g.awayTeamScore ?? g.away?.score ?? 0;

      const opponentScore = isCowboysHome
        ? g.awayScore ?? g.awayTeamScore ?? g.away?.score ?? 0
        : g.homeScore ?? g.homeTeamScore ?? g.home?.score ?? 0;

      totalPointsFor += cowboysScore;
      totalPointsAgainst += opponentScore;
    }

    // Compute average points scored and allowed
    const offensiveRating = Number((totalPointsFor / games.length).toFixed(1));
    const defensiveRating = Number((totalPointsAgainst / games.length).toFixed(1));

    // Build response
    const result = {
      record: record.text,            // e.g. "3-4-1"
      winPercentage: record.winPct,   // e.g. 0.375
      offensiveRating,                // e.g. 22.8
      defensiveRating,                // e.g. 18.4
    };

    res.json(result);
  } catch (err) {
    console.error("Error computing Cowboys performance:", err);
    res.json({
      record: "0-0-0",
      winPercentage: 0.0,
      offensiveRating: 0.0,
      defensiveRating: 0.0,
    });
  }
});

/**
 * Optional: GET Cowboys schedule only (season-to-date)
 * Example: /api/cowboys/schedule?year=2025
 */
router.get("/schedule", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const games = await fetchCowboysGamesSeasonToDate(year);
    res.json({ year, games });
  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ error: "Failed to fetch Cowboys schedule" });
  }
});

export default router;


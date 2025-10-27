import { Router } from "express";
import {
  fetchCowboysGamesSeasonToDate,
  computeRecordFromGames,
} from "../services/espn.js";

const router = Router();

/**
 * GET live+final Cowboys games (season-to-date, includes today's game).
 * Query: ?year=2025 (defaults to current year)
 */
router.get("/schedule", async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const games = await fetchCowboysGamesSeasonToDate(year);
    res.json({ year, games });
  } catch (e) {
    next(e);
  }
});

/**
 * GET Cowboys record (W-L-T) recalculated on the fly (real-time).
 * Query: ?year=2025
 */
router.get("/record", async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const games = await fetchCowboysGamesSeasonToDate(year);
    const record = computeRecordFromGames(games);
    res.json({ year, ...record });
  } catch (e) {
    next(e);
  }
});

export default router;

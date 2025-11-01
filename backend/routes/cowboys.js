const express = require("express");
const router = express.Router();
const { fetchCowboysGamesSeasonToDate, computeRecordFromGames } = require("../services/espn");

router.get("/", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const games = await fetchCowboysGamesSeasonToDate(year);

    if (!games || games.length === 0) {
      return res.json({
        record: "0-0-0",
        winPercentage: 0.0,
        offensiveRating: 0.0,
        defensiveRating: 0.0,
      });
    }

    const record = computeRecordFromGames(games);

    let totalPointsFor = 0;
    let totalPointsAgainst = 0;

    for (const g of games) {
      const homeAbbr = g.homeTeam?.abbreviation || "";
      const awayAbbr = g.awayTeam?.abbreviation || "";

      const isCowboysHome = homeAbbr === "DAL" || g.homeTeam?.displayName?.includes("Cowboys");

      const cowboysScore = isCowboysHome
        ? g.homeScore ?? g.homeTeamScore ?? 0
        : g.awayScore ?? g.awayTeamScore ?? 0;

      const opponentScore = isCowboysHome
        ? g.awayScore ?? g.awayTeamScore ?? 0
        : g.homeScore ?? g.homeTeamScore ?? 0;

      totalPointsFor += cowboysScore;
      totalPointsAgainst += opponentScore;
    }

    const offensiveRating = Number((totalPointsFor / games.length).toFixed(1));
    const defensiveRating = Number((totalPointsAgainst / games.length).toFixed(1));

    res.json({
      record: record.text,
      winPercentage: record.winPct,
      offensiveRating,
      defensiveRating,
    });
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

module.exports = router;

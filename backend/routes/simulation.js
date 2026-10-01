const express = require("express");
const router = express.Router();
const { teamOr400 } = require("../middleware/teamParam");

const { getPowerRatings, buildLeagueGames, ELO_BASE } = require("../services/ratingsEngine");
const { simulateSeason } = require("../services/seasonSimulator");

/* What-if scenarios, each a change to the rating table before the league
   season simulation runs. Sizes come from the 2012-25 backtest where one
   exists: a backup quarterback starting cost about 90 Elo per game. */
const SCENARIOS = {
  injury_qb: {
    label: "Starting QB out for the season",
    story: (team) =>
      `${team} plays the rest of the season with its backup quarterback: -90 Elo, ` +
      "the per-game cost of a backup start in the 2012-25 backtest.",
    apply: (rows, { team }) =>
      rows.map((r) => (r.code === team ? { ...r, power: r.power - 90 } : r)),
  },
  easy_schedule: {
    label: "Remaining opponents weakened",
    story: (team) =>
      `Every team still on ${team}'s schedule is 30 Elo weaker (about 1.2 points a game), ` +
      "as if injuries hit the other side.",
    apply: (rows, { opponents }) =>
      rows.map((r) => (opponents.has(r.code) ? { ...r, power: r.power - 30 } : r)),
  },
  weather_snow: {
    label: "Chaos season",
    story: () =>
      "Every rating is pulled 30% toward average, so favorites win less often and upsets " +
      "pile up across the league.",
    apply: (rows) =>
      rows.map((r) => ({ ...r, power: ELO_BASE + (r.power - ELO_BASE) * 0.7 })),
  },
};

const MODES = {
  hot: { hot: true, label: "League simulation (hot Elo)" },
  fixed: { hot: false, label: "League simulation (fixed Elo)" },
};

router.post("/run", async (req, res) => {
  try {
    const {
      modelType = "hot",
      scenario = null,
      iterations = 5000,
      team: rawTeam = "DAL",
    } = req.body || {};

    const team = teamOr400(res, rawTeam);
    if (!team) return;
    const mode = MODES[modelType] || MODES.hot; // older clients send other names
    const iters = Math.max(1000, Math.min(20000, Number(iterations) || 5000));
    const shock = SCENARIOS[scenario] || null;

    const ratings = await getPowerRatings({});
    const { games } = await buildLeagueGames(ratings.year);
    const opponents = new Set(
      games
        .filter((g) => !g.completed && (g.homeTeamAbbr === team || g.awayTeamAbbr === team))
        .map((g) => (g.homeTeamAbbr === team ? g.awayTeamAbbr : g.homeTeamAbbr))
    );

    const run = (rows) =>
      simulateSeason({
        ratingsOverride: { ...ratings, ratings: rows },
        gamesOverride: games,
        iterations: iters,
        seed: 4242,
        hot: mode.hot,
      });

    const baseline = await run(ratings.ratings);
    const scenarioRun = shock ? await run(shock.apply(ratings.ratings, { team, opponents })) : baseline;

    const pick = (sim) => sim.teams.find((t) => t.code === team);
    const base = pick(baseline);
    const out = pick(scenarioRun);
    if (!out) return res.status(404).json({ success: false, error: `No simulation for ${team}` });

    const wins = out.avgWins;
    const losses = out.avgLosses;

    res.json({
      success: true,
      modelUsed: mode.label,
      scenarioApplied: scenario,
      results: {
        // winProbability keeps its old name for existing clients; it is playoff odds.
        winProbability: out.playoffPct,
        playoffProbability: out.playoffPct,
        baselinePlayoffProbability: base.playoffPct,
        deltaPts: Number((out.playoffPct - base.playoffPct).toFixed(1)),
        divisionProbability: out.divisionPct,
        superBowlProbability: out.winSBPct,
        projectedRecord: `${wins.toFixed(1)}-${losses.toFixed(1)}`,
        confidenceScore: out.playoffPct,
        story: shock
          ? shock.story(team)
          : `${team}'s season as the live model sees it: every remaining game, all 32 teams, NFL tiebreakers.`,
      },
      meta: {
        source: "league-simulation",
        team,
        iterations: scenarioRun.iterations,
        gamesRemaining: scenarioRun.gamesRemaining,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({
      success: false,
      error: "Simulation failed",
    });
  }
});

router.SCENARIOS = SCENARIOS;

module.exports = router;

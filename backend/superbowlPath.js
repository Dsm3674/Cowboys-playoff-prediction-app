const express = require("express");
const router = express.Router();
const { teamOr400 } = require("./middleware/teamParam");
const Team = require("./teams");
const Season = require("./seasons");
const Prediction = require("./predictions");
const { getSessionIdentity } = require("./middleware/sessionAuth");

const { generateEspnPrediction } = require("./prediction");
const { getSeasonSimulation } = require("./services/seasonSimulator");
const { getPowerRatings, buildLeagueGames, eloWinProb, ELO_BASE, ELO_HOME_FIELD } = require("./services/ratingsEngine");

/**
 * Teams ordered by remaining-schedule difficulty, hardest first, using the
 * Schedule Strength page's measure: how often an average team would lose
 * those games. Also returns the top-rated team.
 */
async function scheduleOrder(year) {
  const ratings = await getPowerRatings({ year });
  const { games } = await buildLeagueGames(ratings.year);
  const power = Object.fromEntries(ratings.ratings.map((r) => [r.code, r.power]));
  const difficulty = {};
  for (const code of Object.keys(power)) {
    const shares = games
      .filter((g) => !g.completed && (g.homeTeamAbbr === code || g.awayTeamAbbr === code))
      .map((g) => {
        const home = g.homeTeamAbbr === code;
        const opp = home ? g.awayTeamAbbr : g.homeTeamAbbr;
        if (!Number.isFinite(power[opp])) return null;
        const hfa = g.neutralSite ? 0 : home ? ELO_HOME_FIELD : -ELO_HOME_FIELD;
        return 1 - eloWinProb(ELO_BASE, power[opp], hfa);
      })
      .filter((x) => x != null);
    if (shares.length) difficulty[code] = shares.reduce((a, b) => a + b, 0) / shares.length;
  }
  const top = ratings.ratings.slice().sort((a, b) => b.power - a.power)[0];
  return {
    order: Object.keys(difficulty).sort((a, b) => difficulty[b] - difficulty[a]),
    topPower: top ? { code: top.code, power: Math.round(top.power) } : null,
  };
}

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (/^[^@\s]+@gmail\.com$/i.test(normalized)) return normalized;
  // Anonymous cryptographic identities (anon-xxxx-xxxx-xxxx) are valid users too.
  if (/^anon-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(normalized)) {
    return normalized;
  }
  return "";
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((out, part) => {
      const eq = part.indexOf("=");
      if (eq === -1) return out;
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);
      try {
        out[key] = decodeURIComponent(value);
      } catch (_err) {
        out[key] = value;
      }
      return out;
    }, {});
}

function normalizeHistoryId(value) {
  const id = String(value || "").trim();
  if (!id || id.length > 128) return "";
  return /^[a-zA-Z0-9._:-]+$/.test(id) ? id : "";
}

function getHistoryIdentity(req) {
  const cookies = parseCookies(req.headers.cookie);
  return {
    userEmail: normalizeEmail(getSessionIdentity(req)),
    historyClientId: normalizeHistoryId(
      req.get("X-LoneStar-History-Id") ||
        req.get("X-Lonestar-History-Id") ||
        cookies.lsi_history ||
        req.query.historyId
    )
  };
}

/* ---------------------------------------------------
   POST /api/prediction/generate
   Generates a new prediction and saves it to DB
--------------------------------------------------- */
router.post("/generate", async (req, res) => {
  try {
    const { modelType = "Balanced" } = req.body;
    const identity = getHistoryIdentity(req);

    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) {
      return res.status(404).json({ error: "Cowboys not found" });
    }

    const season = await Season.getCurrentSeason(cowboys.team_id);
    if (!season) {
      return res.status(404).json({ error: "No season found" });
    }

    const result = await generateEspnPrediction({
      year: season.year,
      modelType,
    });

    // The league simulation supplies every rung of the ladder. The old fixed
    // multipliers (division = playoff × 0.6, …) are only a fallback.
    const league = result.league;
    const playoffProb = league ? league.playoffProbability : result.playoffProbability;
    const expectedWins = league ? league.expectedWins : result.expectedWins;

    const saved = await Prediction.create({
      seasonId: season.season_id,
      playoffProb,
      divisionProb: league ? league.divisionProbability : Math.min(playoffProb * 0.6, 0.9),
      conferenceProb: league ? league.conferenceProbability : Math.min(playoffProb * 0.35, 0.7),
      superbowlProb: league ? league.superbowlProbability : Math.min(playoffProb * 0.15, 0.4),
      confidenceScore: Math.round(playoffProb * 100),
      factors: {
        model: league ? league.engine : result.modelUsed,
        perGameWinProbabilities: result.perGameWinProbabilities,
        expectedWins,
        iterations: league ? league.iterations : undefined,
        source: "ESPN",
      },
      modelVersion: league ? "league-sim-v1" : `espn-mc-${modelType.toLowerCase()}`,
      userEmail: identity.userEmail,
      historyClientId: identity.historyClientId,
    });

    res.json({
      success: true,
      prediction: {
        playoff_probability: saved.playoff_probability,
        division_probability: saved.division_probability,
        conference_probability: saved.conference_probability,
        superbowl_probability: saved.superbowl_probability,
        expected_wins: expectedWins,
        record: result.currentRecord,
        model_used: result.modelUsed,
      },
    });
  } catch (err) {
    console.error("Prediction error:", err);
    res.status(500).json({ error: "Prediction failed" });
  }
});


/* ---------------------------------------------------
   GET /api/prediction/current
   The live league simulation's read on the Cowboys plus league headlines.
   Read-only (nothing is saved), so the landing page can call it on load.
--------------------------------------------------- */
const toProb = (pct) => Number((pct / 100).toFixed(4));

router.get("/current", async (req, res) => {
  try {
    const team = teamOr400(res, req.query.team);
    if (!team) return;
    const sim = await getSeasonSimulation({});
    const row = sim.teams.find((t) => t.code === team);
    if (!row) return res.status(404).json({ error: `No simulation for ${team}` });

    const favorite = sim.teams.slice().sort((a, b) => b.winSBPct - a.winSBPct)[0];
    const schedule = await scheduleOrder(sim.year).catch(() => null);
    const sosIndex = schedule ? schedule.order.indexOf(team) : -1;
    const sosRank = sosIndex >= 0 ? sosIndex + 1 : null;
    const bubble = sim.teams
      .filter((t) => t.playoffPct >= 30 && t.playoffPct <= 70)
      .sort((a, b) => Math.abs(a.playoffPct - 50) - Math.abs(b.playoffPct - 50))
      .slice(0, 3)
      .map((t) => t.code);

    res.json({
      success: true,
      prediction: {
        team,
        playoff_probability: toProb(row.playoffPct),
        division_probability: toProb(row.divisionPct),
        bye_probability: toProb(row.byePct),
        conference_probability: toProb(row.reachSBPct),
        superbowl_probability: toProb(row.winSBPct),
        expected_wins: row.avgWins,
        // Seed in the most likely bracket, or null when projected out.
        projected_seed: Object.values(sim.projectedSeeds || {}).flat().find((t) => t.code === team)?.seed ?? null,
        sos_rank: sosRank,
        // Share of simulated seasons ending on each win total.
        win_distribution: row.winsDistribution,
      },
      league: {
        topSeeds: {
          AFC: sim.projectedSeeds.AFC?.[0]?.code || null,
          NFC: sim.projectedSeeds.NFC?.[0]?.code || null,
        },
        superBowlFavorite: favorite ? { code: favorite.code, pct: favorite.winSBPct } : null,
        bubble,
        toughestSchedule: schedule?.order[0] || null,
        topPower: schedule?.topPower || null,
      },
      meta: {
        engine: sim.engine,
        iterations: sim.iterations,
        lastCompletedWeek: sim.lastCompletedWeek,
      },
    });
  } catch (err) {
    console.error("Current prediction error:", err);
    res.status(500).json({ error: "Prediction unavailable" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const identity = getHistoryIdentity(req);
    const rows = await Prediction.getHistoryForIdentity(identity, req.query.limit);
    res.json({
      history: rows,
      scope: identity.userEmail ? "gmail" : identity.historyClientId ? "browser" : "none"
    });
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

module.exports = router;

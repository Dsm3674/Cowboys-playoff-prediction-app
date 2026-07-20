"use strict";

const express = require("express");
const router = express.Router();
const cache = require("../cache");

const { computeWinProbability } = require("../winprob");
const { computeTSI } = require("../tsi");
const { buildSeasonPaths, computeMustWinGames } = require("../seasonPath");
const { computeRivalImpact } = require("../rivalAnalysis");
const {
  getNFLTeamList,
  getNFLTeamMetadata,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
  normalizeTeamAbbr
} = require("../services/espn");
const { getEloSnapshot, blendWithElo, eloWinProb } = require("../services/ratingsEngine");

/* Stamp each row with the Elo engine's power number so downstream strength
   formulas can fold it in. No-op when Elo has nothing informative to say. */
async function attachElo(rows, year) {
  const snap = await getEloSnapshot({ year });
  const list = Array.isArray(rows) ? rows : [rows];
  for (const row of list) {
    const power = snap.byTeam[row.code]?.power;
    row._elo = snap.available && Number.isFinite(power) ? power : null;
  }
  return rows;
}

function sortStandings(a, b) {
  const pctDiff = (b.record.winPct || 0) - (a.record.winPct || 0);
  if (pctDiff !== 0) return pctDiff;

  const pointDiffA = a.averages?.pointDiffPerGame || 0;
  const pointDiffB = b.averages?.pointDiffPerGame || 0;
  if (pointDiffB !== pointDiffA) return pointDiffB - pointDiffA;

  return (b.tsi || 0) - (a.tsi || 0);
}

function buildDivisionStandings(rows) {
  return rows
    .sort(sortStandings)
    .map((team) => ({
      code: team.code,
      name: team.name,
      record: team.record,
      tsi: team.tsi,
      avgFor: Number(team.averages.avgFor.toFixed(1)),
      avgAgainst: Number(team.averages.avgAgainst.toFixed(1)),
      pointDiffPerGame: Number(team.averages.pointDiffPerGame.toFixed(1))
    }));
}

function buildDivisionPower(rows) {
  const divisions = rows.reduce((acc, team) => {
    const key = `${team.conference}|${team.division}`;
    acc[key] = acc[key] || {
      conference: team.conference,
      division: team.division,
      teams: [],
      totalTSI: 0,
      totalWinPct: 0,
      totalPointDiff: 0
    };

    acc[key].teams.push(team);
    acc[key].totalTSI += team.tsi || 0;
    acc[key].totalWinPct += team.record.winPct || 0;
    acc[key].totalPointDiff += team.averages.pointDiffPerGame || 0;
    return acc;
  }, {});

  return Object.values(divisions).map((division) => {
    const count = division.teams.length || 1;
    const leader = [...division.teams].sort(sortStandings)[0] || {};
    return {
      conference: division.conference,
      division: division.division,
      teamCount: count,
      averageTSI: Number((division.totalTSI / count).toFixed(1)),
      averageWinPct: Number((division.totalWinPct / count).toFixed(3)),
      averagePointDiff: Number((division.totalPointDiff / count).toFixed(1)),
      leader: {
        code: leader.code,
        name: leader.name,
        record: leader.record,
        tsi: leader.tsi
      },
      teams: division.teams.map((team) => ({
        code: team.code,
        name: team.name,
        record: team.record,
        tsi: team.tsi,
        pointDiffPerGame: Number(team.averages.pointDiffPerGame.toFixed(1))
      }))
    };
  });
}

function buildStandingsByConference(rows) {
  return rows.reduce((acc, team) => {
    const conference = team.conference || "Unknown";
    const division = team.division || "Unknown";
    acc[conference] = acc[conference] || {};
    acc[conference][division] = acc[conference][division] || [];
    acc[conference][division].push(team);
    return acc;
  }, {});
}

async function fetchTeamSummary(teamCode, year) {
  const games = await fetchTeamGamesSeasonToDate(teamCode, year);
  const record = computeRecordFromGames(games, teamCode);
  const averages = computeTeamAveragesFromGames(teamCode, games);
  const tsi = await computeTSI({ teamAbbr: teamCode, year }).catch(() => ({ tsi: 0, components: {} }));
  const metadata = getNFLTeamMetadata(teamCode) || {};

  return {
    code: teamCode,
    name: metadata.displayName || teamCode,
    conference: metadata.conference || "Unknown",
    division: metadata.division || "Unknown",
    record,
    averages,
    tsi: tsi.tsi || 0,
    components: tsi.components || {},
    games
  };
}

function summarizeComparison(left, right) {
  return {
    tsiDifference: Number((left.tsi - right.tsi).toFixed(1)),
    winPctDifference: Number(((left.record.winPct || 0) - (right.record.winPct || 0)).toFixed(3)),
    pointDiffDifference: Number((left.averages.pointDiffPerGame - right.averages.pointDiffPerGame).toFixed(1))
  };
}

function findHeadToHeadGames(team1, team2, games) {
  return games.filter((game) => {
    const home = String(game.homeTeamAbbr || "").toUpperCase();
    const away = String(game.awayTeamAbbr || "").toUpperCase();
    return (home === team1 && away === team2) || (home === team2 && away === team1);
  });
}

function buildForecast(rows) {
  return rows.map((team) => {
    const completedGames = (team.record.wins || 0) + (team.record.losses || 0) + (team.record.ties || 0);
    const remainingGames = Math.max(0, 17 - completedGames);
    const currentWinPct = team.record.winPct || 0;
    const projectedWinRate = Math.max(
      0,
      Math.min(1, currentWinPct * 0.55 + (team.tsi / 100) * 0.45)
    );
    const projectedWins = Number((team.record.wins + projectedWinRate * remainingGames).toFixed(1));
    const projectedLosses = Number((team.record.losses + (1 - projectedWinRate) * remainingGames).toFixed(1));

    return {
      code: team.code,
      name: team.name,
      conference: team.conference,
      division: team.division,
      record: team.record,
      tsi: team.tsi,
      averagePointDiff: Number(team.averages.pointDiffPerGame.toFixed(1)),
      projectedWins,
      projectedLosses,
      projectedWinRate: Number((projectedWinRate * 100).toFixed(1)),
      remainingGames,
      projectionScore: Number((projectedWinRate * 100 + team.tsi * 0.35).toFixed(1))
    };
  }).sort((a, b) => b.projectionScore - a.projectionScore || b.projectedWinRate - a.projectedWinRate);
}

router.post("/winprob", (req, res) => {
  try {
    const wp = computeWinProbability(req.body);
    res.json({ success: true, winProbability: wp });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get("/tsi", async (req, res) => {
  try {
    const team = (req.query.team || "DAL").toUpperCase();
    const year = Number(req.query.year) || undefined;
    const out = await computeTSI({ teamAbbr: team, year });
    res.json({ success: true, ...out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/paths", async (req, res) => {
  try {
    const team = (req.query.team || "DAL").toUpperCase();
    const year = Number(req.query.year) || undefined;
    const k = Math.min(60, Math.max(5, Number(req.query.k) || 25));
    const chaos = Math.min(1, Math.max(0, Number(req.query.chaos) || 0));

    const data = await buildSeasonPaths({ teamAbbr: team, year, k, chaos });
    res.json({ success: true, ...data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/mustwin", async (req, res) => {
  try {
    const team = (req.query.team || "DAL").toUpperCase();
    const year = Number(req.query.year) || undefined;
    const chaos = Math.min(1, Math.max(0, Number(req.query.chaos) || 0));

    const games = await computeMustWinGames({ teamAbbr: team, year, chaos });
    res.json({ success: true, games });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/standings", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const teams = await getNFLTeamList();
    const rows = await Promise.all(
      teams.map((team) => fetchTeamSummary(team.code, year))
    );

    const grouped = buildStandingsByConference(rows);
    const result = Object.entries(grouped).reduce((acc, [conference, divisions]) => {
      acc[conference] = Object.entries(divisions).reduce((divisionAcc, [division, teamsInDivision]) => {
        divisionAcc[division] = buildDivisionStandings(teamsInDivision);
        return divisionAcc;
      }, {});
      return acc;
    }, {});

    res.json({ success: true, year: year || new Date().getFullYear(), standings: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/divisions", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const teams = await getNFLTeamList();
    const rows = await Promise.all(
      teams.map((team) => fetchTeamSummary(team.code, year))
    );

    const divisions = buildDivisionPower(rows)
      .sort((a, b) => b.averageTSI - a.averageTSI || b.averageWinPct - a.averageWinPct);

    res.json({ success: true, year: year || new Date().getFullYear(), divisions });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

function computePlayoffProbability(team) {
  const winPct = team.record.winPct || 0;
  const pointDiff = team.averages.pointDiffPerGame || 0;
  const base = winPct * 100;
  const adjusted = base + (team.tsi - 50) * 0.55 + pointDiff * 2.2;
  return Number(Math.max(5, Math.min(99, Math.round(adjusted * 10) / 10)).toFixed(1));
}

function buildPlayoffPulse(rows) {
  return rows
    .map((team) => ({
      code: team.code,
      name: team.name,
      conference: team.conference,
      division: team.division,
      record: team.record,
      tsi: team.tsi,
      averagePointDiff: Number(team.averages.pointDiffPerGame.toFixed(1)),
      playoffProbability: computePlayoffProbability(team)
    }))
    .sort((a, b) => b.playoffProbability - a.playoffProbability || b.tsi - a.tsi);
}

function simulateMatchup(left, right) {
  const leftScore = teamStrength(left);
  const rightScore = teamStrength(right);
  const spread = Number((leftScore - rightScore).toFixed(1));
  let winProb = Math.max(5, Math.min(95, 50 + spread * 1.4)) / 100;

  // Blend in Elo's head-to-head read when both sides carry a rating.
  if (Number.isFinite(left._elo) && Number.isFinite(right._elo)) {
    winProb = blendWithElo(winProb, eloWinProb(left._elo, right._elo, 0), 0.5);
  }

  const winProbability = Number((Math.max(0.05, Math.min(0.95, winProb)) * 100).toFixed(1));
  return {
    homeWinProbability: winProbability,
    awayWinProbability: Number((100 - winProbability).toFixed(1)),
    expectedMargin: spread
  };
}

function buildScheduleStrength(rows) {
  const teamIndex = new Map(rows.map((team) => [team.code, team]));

  return rows
    .map((team) => {
      const remainingGames = (team.games || []).filter((game) => !game.completed);
      const opponentStrength = remainingGames.map((game) => {
        const away = String(game.awayTeamAbbr || "").toUpperCase();
        const home = String(game.homeTeamAbbr || "").toUpperCase();
        const opponent = away === team.code ? home : away;
        return teamIndex.get(opponent)?.tsi || 50;
      });

      const averageOpponentTsi = opponentStrength.length
        ? opponentStrength.reduce((sum, value) => sum + value, 0) / opponentStrength.length
        : 50;

      const remainingCount = remainingGames.length;
      const strengthScore = Number(
        Math.max(
          0,
          Math.min(
            100,
            60 + (averageOpponentTsi - 50) * 0.6 + remainingCount * 2 - team.averages.pointDiffPerGame * 0.4
          )
        ).toFixed(1)
      );

      return {
        code: team.code,
        name: team.name,
        conference: team.conference,
        division: team.division,
        record: team.record,
        tsi: team.tsi,
        remainingGames: remainingCount,
        averageOpponentTsi: Number(averageOpponentTsi.toFixed(1)),
        strengthScore,
        remainingSchedule: remainingGames.map((game) => ({
          date: game.date,
          opponent: String(game.homeTeamAbbr || "").toUpperCase() === team.code ? String(game.awayTeamAbbr || "").toUpperCase() : String(game.homeTeamAbbr || "").toUpperCase(),
          location: String(game.homeTeamAbbr || "").toUpperCase() === team.code ? "Road" : "Home"
        }))
      };
    })
    .sort((a, b) => b.strengthScore - a.strengthScore || b.averageOpponentTsi - a.averageOpponentTsi);
}

router.get("/forecast", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const teams = await getNFLTeamList();
    const rows = await Promise.all(
      teams.map((team) => fetchTeamSummary(team.code, year))
    );

    const forecast = buildForecast(rows);
    res.json({ success: true, year: year || new Date().getFullYear(), forecast });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/schedule-strength", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const teams = await getNFLTeamList();
    const rows = await Promise.all(
      teams.map((team) => fetchTeamSummary(team.code, year))
    );

    const scheduleStrength = buildScheduleStrength(rows);
    res.json({ success: true, year: year || new Date().getFullYear(), scheduleStrength });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/playoff", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const teams = await getNFLTeamList();
    const rows = await Promise.all(
      teams.map((team) => fetchTeamSummary(team.code, year))
    );

    const pulse = buildPlayoffPulse(rows);
    res.json({ success: true, year: year || new Date().getFullYear(), pulse });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ---------------------------------------------------------------------------
   Playoff bracket builder
   Seeds a full 14-team postseason bracket from live season-to-date team data
   (records, TSI, point differential) and projects every round forward using a
   logistic matchup model. Returns the same shape the PlayoffBracket UI uses.
--------------------------------------------------------------------------- */

const BRACKET_HOME_BUMP = 3; // higher seed hosts — small strength advantage

function teamStrength(team) {
  const winPct = team.record?.winPct || 0;
  const pointDiff = team.averages?.pointDiffPerGame || 0;
  const tsi = team.tsi || 0;
  // Elo joins the blend when attached (±150 Elo ≈ ±25 strength points).
  const eloTerm = Number.isFinite(team._elo) ? (team._elo - 1500) / 6 : 0;
  return tsi * 0.6 + winPct * 40 + pointDiff * 1.2 + eloTerm;
}

function byStrengthDesc(a, b) {
  const diff = teamStrength(b) - teamStrength(a);
  if (diff !== 0) return diff;
  return (b.record?.winPct || 0) - (a.record?.winPct || 0);
}

/* probability the first team beats the second, given a strength advantage */
function matchupProbability(teamA, teamB, homeBump = 0) {
  const spread = teamStrength(teamA) - teamStrength(teamB) + homeBump;
  const p = 1 / (1 + Math.exp(-spread * 0.06));
  return Math.max(0.08, Math.min(0.92, p));
}

function toSlot(team, prob) {
  return {
    seed: team._seed,
    abbr: team.code,
    name: team.name,
    prob: Math.round(prob * 100)
  };
}

/* order two teams so the higher seed (lower seed number) comes first */
function orderBySeed(a, b) {
  return (a._seed || 99) <= (b._seed || 99) ? [a, b] : [b, a];
}

/* build a single game; first arg is the home/higher seed */
function makeGame(home, away, useHomeBump = true) {
  const pHome = matchupProbability(home, away, useHomeBump ? BRACKET_HOME_BUMP : 0);
  const homeWins = pHome >= 0.5;
  return {
    top: toSlot(home, pHome),
    bottom: toSlot(away, 1 - pHome),
    _winner: homeWins ? home : away
  };
}

function stripGame(game) {
  return { top: game.top, bottom: game.bottom };
}

function buildConferenceBracket(confRows) {
  /* division winners (best team per division) take seeds 1–4 */
  const byDivision = confRows.reduce((acc, team) => {
    (acc[team.division] = acc[team.division] || []).push(team);
    return acc;
  }, {});

  const divisionWinners = Object.values(byDivision)
    .map((list) => list.slice().sort(byStrengthDesc)[0])
    .filter(Boolean)
    .sort(byStrengthDesc)
    .slice(0, 4);

  const winnerCodes = new Set(divisionWinners.map((t) => t.code));

  /* next three best non-division-winners are wild cards (seeds 5–7) */
  const wildcards = confRows
    .filter((t) => !winnerCodes.has(t.code))
    .sort(byStrengthDesc)
    .slice(0, 3);

  const seeds = [...divisionWinners, ...wildcards];
  seeds.forEach((team, i) => { team._seed = i + 1; });
  const s = (n) => seeds[n - 1];

  /* need a full 7-team field to build a standard bracket */
  if (seeds.length < 7 || seeds.some((t) => !t)) return null;

  /* Wild Card round: 2v7, 3v6, 4v5 (1 seed byes) */
  const wc1 = makeGame(s(2), s(7));
  const wc2 = makeGame(s(3), s(6));
  const wc3 = makeGame(s(4), s(5));

  /* Divisional round (fixed-path bracket):
       slot 0 (top)    = WC1 winner vs WC2 winner
       slot 1 (bottom) = 1-seed vs WC3 winner */
  const d0 = makeGame(...orderBySeed(wc1._winner, wc2._winner));
  const d1 = makeGame(...orderBySeed(s(1), wc3._winner));

  /* Conference Championship */
  const cc = makeGame(...orderBySeed(d0._winner, d1._winner));

  return {
    championship: stripGame(cc),
    divisional: [stripGame(d0), stripGame(d1)],
    wildCard: [stripGame(wc1), stripGame(wc2), stripGame(wc3)],
    champion: cc._winner
  };
}

function buildPlayoffBracket(rows, year) {
  const afcRows = rows.filter((t) => t.conference === "AFC");
  const nfcRows = rows.filter((t) => t.conference === "NFC");

  const afc = buildConferenceBracket(afcRows);
  const nfc = buildConferenceBracket(nfcRows);

  if (!afc || !nfc) return null;

  /* super bowl is neutral-site, so no home bump; labels are by conference */
  const afcProb = Math.round(matchupProbability(afc.champion, nfc.champion, 0) * 100);

  return {
    year: year || new Date().getFullYear(),
    superBowl: {
      afc: { seed: afc.champion._seed, abbr: afc.champion.code, name: afc.champion.name, prob: afcProb },
      nfc: { seed: nfc.champion._seed, abbr: nfc.champion.code, name: nfc.champion.name, prob: 100 - afcProb }
    },
    afc: { championship: afc.championship, divisional: afc.divisional, wildCard: afc.wildCard },
    nfc: { championship: nfc.championship, divisional: nfc.divisional, wildCard: nfc.wildCard }
  };
}

router.get("/bracket", async (req, res) => {
  try {
    const year = Number(req.query.year) || undefined;
    const teams = await getNFLTeamList();
    const rows = await Promise.all(
      teams.map((team) => fetchTeamSummary(team.code, year))
    );
    await attachElo(rows, year);

    const bracket = buildPlayoffBracket(rows, year);
    if (!bracket) {
      return res.json({ success: false, reason: "Not enough season data to seed a bracket yet." });
    }

    res.json({ success: true, ...bracket });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/matchup", async (req, res) => {
  try {
    const team1 = normalizeTeamAbbr(req.query.team1 || "DAL");
    const team2 = normalizeTeamAbbr(req.query.team2 || "PHI");
    const year = Number(req.query.year) || undefined;
    const left = await fetchTeamSummary(team1, year);
    const right = await fetchTeamSummary(team2, year);
    await attachElo([left, right], year);
    const matchup = simulateMatchup(left, right);

    res.json({ success: true, year: year || new Date().getFullYear(), teams: [left, right], matchup });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/compare", async (req, res) => {
  try {
    const team1 = normalizeTeamAbbr(req.query.team1 || "DAL");
    const team2 = normalizeTeamAbbr(req.query.team2 || "PHI");
    const year = Number(req.query.year) || undefined;

    const left = await fetchTeamSummary(team1, year);
    const right = await fetchTeamSummary(team2, year);
    const headToHead = findHeadToHeadGames(team1, team2, left.games);
    const difference = summarizeComparison(left, right);

    res.json({ success: true, year: year || new Date().getFullYear(), teams: [left, right], difference, headToHead });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/rivalimpact", async (req, res) => {
  try {
    const team = String(req.query.team || "DAL").toUpperCase();
    const year = Number(req.query.year) || undefined;
    const result = await computeRivalImpact({ teamAbbr: team, year });

    res.json({
      ...result,
      requestMeta: {
        ignoredQueryParams: {
          chaos: req.query.chaos ?? null,
          iterations: req.query.iterations ?? null
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/teams", async (req, res) => {
  try {
    const teams = await getNFLTeamList();
    res.json({ success: true, teams });
  } catch (e) {
    console.error("Error fetching NFL teams:", e);
    res.status(500).json({ success: false, error: "Unable to load NFL teams" });
  }
});

router.get("/cache-stats", async (req, res) => {
  try {
    const metrics = cache.getMetrics();
    const keys = await cache.keys("*");

    res.json({
      timestamp: new Date().toISOString(),
      metrics: {
        hits: metrics.hits,
        misses: metrics.misses,
        hitRate: metrics.hitRate,
        sets: metrics.sets,
        deletes: metrics.deletes,
        errors: metrics.errors,
        size: metrics.size,
        backend: metrics.backend,
        redisConnected: metrics.redisConnected
      },
      keys: keys.slice(0, 50),
      totalKeys: keys.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/metrics", async (req, res) => {
  try {
    const cacheMetrics = cache.getMetrics();

    let output = "# HELP cache_hits_total Cache hit count\n";
    output += "# TYPE cache_hits_total counter\n";
    output += `cache_hits_total ${cacheMetrics.hits}\n\n`;

    output += "# HELP cache_misses_total Cache miss count\n";
    output += "# TYPE cache_misses_total counter\n";
    output += `cache_misses_total ${cacheMetrics.misses}\n\n`;

    output += "# HELP cache_hit_rate Cache hit rate percentage\n";
    output += "# TYPE cache_hit_rate gauge\n";
    output += `cache_hit_rate ${parseFloat(cacheMetrics.hitRate)}\n\n`;

    output += "# HELP cache_keys Cache stored keys count\n";
    output += "# TYPE cache_keys gauge\n";
    output += `cache_keys ${cacheMetrics.size}\n\n`;

    output += "# HELP cache_errors Cache operation errors\n";
    output += "# TYPE cache_errors counter\n";
    output += `cache_errors ${cacheMetrics.errors}\n\n`;

    output += "# HELP cache_backend Cache backend (0=memory, 1=redis)\n";
    output += "# TYPE cache_backend gauge\n";
    output += `cache_backend ${cacheMetrics.backend === "redis" ? 1 : 0}\n\n`;

    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send(output);
  } catch (e) {
    res.status(500).send(`# ERROR: ${e.message}`);
  }
});

module.exports = router;

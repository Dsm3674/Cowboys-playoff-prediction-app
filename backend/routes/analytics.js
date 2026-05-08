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
  getNFLTeamCatalog,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
  normalizeTeamAbbr
} = require("../services/espn");

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
  const metadata = getNFLTeamCatalog().find((team) => team.abbreviation === teamCode) || {};

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
  const leftScore = left.tsi * 0.6 + (left.record.winPct || 0) * 40 + left.averages.pointDiffPerGame * 1.2;
  const rightScore = right.tsi * 0.6 + (right.record.winPct || 0) * 40 + right.averages.pointDiffPerGame * 1.2;
  const spread = Number((leftScore - rightScore).toFixed(1));
  const winProbability = Number(Math.max(5, Math.min(95, 50 + spread * 1.4)).toFixed(1));

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

router.get("/matchup", async (req, res) => {
  try {
    const team1 = normalizeTeamAbbr(req.query.team1 || "DAL");
    const team2 = normalizeTeamAbbr(req.query.team2 || "PHI");
    const year = Number(req.query.year) || undefined;
    const left = await fetchTeamSummary(team1, year);
    const right = await fetchTeamSummary(team2, year);
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

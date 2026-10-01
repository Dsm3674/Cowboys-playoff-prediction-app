"use strict";

const express = require("express");
const router = express.Router();
const { teamOr400 } = require("../middleware/teamParam");
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
  getNFLSeasonYear
} = require("../services/espn");
const { getEloSnapshot, eloWinProb, ELO_BASE, ELO_HOME_FIELD, buildLeagueGames } = require("../services/ratingsEngine");
const { getSimulationByTeam, getSeasonSimulation, currentStandings } = require("../services/seasonSimulator");

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

/* Stamp each row with its season-averaged injury Elo cost. Forecast and
   playoff pulse are built from results and TSI, which can't see who's hurt;
   this is the only forward-looking roster signal they get. */
async function attachInjuries(rows, year) {
  const snap = await getEloSnapshot({ year });
  for (const row of Array.isArray(rows) ? rows : [rows]) {
    row._injuryDelta = snap.byTeam[row.code]?.injuryDelta || 0;
  }
  return rows;
}

/* Per-game win-probability change implied by an Elo delta vs an even opponent. */
function injuryWinShift(team) {
  const d = Number(team._injuryDelta) || 0;
  return d ? eloWinProb(ELO_BASE + d, ELO_BASE, 0) - 0.5 : 0;
}

function sortStandings(a, b) {
  const pctDiff = (b.record.winPct || 0) - (a.record.winPct || 0);
  if (pctDiff !== 0) return pctDiff;

  const pointDiffA = a.averages?.pointDiffPerGame || 0;
  const pointDiffB = b.averages?.pointDiffPerGame || 0;
  if (pointDiffB !== pointDiffA) return pointDiffB - pointDiffA;

  return (b.tsi || 0) - (a.tsi || 0);
}

/* Division order: NFL tiebreakers when `order` (code → { divisionRank, seed })
   is available, the win%/point-differential sort otherwise. */
function buildDivisionStandings(rows, order = {}) {
  const byRank = (a, b) =>
    order[a.code] && order[b.code]
      ? order[a.code].divisionRank - order[b.code].divisionRank
      : sortStandings(a, b);
  return rows
    .sort(byRank)
    .map((team) => ({
      code: team.code,
      name: team.name,
      record: team.record,
      seed: order[team.code]?.seed ?? null,
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
      totalPointDiff: 0,
      totalPower: 0,
      rated: 0
    };

    acc[key].teams.push(team);
    acc[key].totalTSI += team.tsi || 0;
    if (Number.isFinite(team._elo)) {
      acc[key].totalPower += team._elo;
      acc[key].rated += 1;
    }
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
      // Elo power: the model's own strength measure (TSI is a stats summary).
      averagePower: division.rated ? Number((division.totalPower / division.rated).toFixed(1)) : null,
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
        power: Number.isFinite(team._elo) ? Number(team._elo.toFixed(1)) : null,
        components: team.components || {},
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

/* Simulator odds for a team as the percentages the pages display. */
function simOdds(sim) {
  return sim
    ? {
        playoffProbability: Number(sim.playoffPct.toFixed(1)),
        divisionProbability: Number(sim.divisionPct.toFixed(1)),
        byeProbability: Number(sim.byePct.toFixed(1)),
        superBowlProbability: Number(sim.winSBPct.toFixed(1)),
      }
    : {};
}

/**
 * Projected records. With a league simulation (`simByCode`), wins are the
 * simulated average; without one, the legacy blend of current win% and TSI.
 */
function buildForecast(rows, simByCode = {}) {
  return rows.map((team) => {
    const completedGames = (team.record.wins || 0) + (team.record.losses || 0) + (team.record.ties || 0);
    const remainingGames = Math.max(0, 17 - completedGames);
    const currentWinPct = team.record.winPct || 0;
    const sim = simByCode[team.code];

    let projectedWinRate;
    let projectedWins;
    let projectedLosses;
    if (sim) {
      projectedWins = Number(sim.avgWins.toFixed(1));
      projectedLosses = Number(sim.avgLosses.toFixed(1));
      projectedWinRate = remainingGames > 0
        ? Math.max(0, Math.min(1, (sim.avgWins - (team.record.wins || 0)) / remainingGames))
        : currentWinPct;
    } else {
      projectedWinRate = Math.max(
        0,
        Math.min(1, currentWinPct * 0.55 + (team.tsi / 100) * 0.45 + injuryWinShift(team))
      );
      projectedWins = Number((team.record.wins + projectedWinRate * remainingGames).toFixed(1));
      projectedLosses = Number((team.record.losses + (1 - projectedWinRate) * remainingGames).toFixed(1));
    }

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
      projectionScore: sim
        ? Number(((sim.avgWins / 17) * 100).toFixed(1))
        : Number((projectedWinRate * 100 + team.tsi * 0.35).toFixed(1)),
      ...simOdds(sim)
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
    const team = teamOr400(res, req.query.team);
    if (!team) return;
    const year = Number(req.query.year) || undefined;
    const out = await computeTSI({ teamAbbr: team, year });
    res.json({ success: true, ...out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/paths", async (req, res) => {
  try {
    const team = teamOr400(res, req.query.team);
    if (!team) return;
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
    const team = teamOr400(res, req.query.team);
    if (!team) return;
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

    // Tiebreak order from the full league schedule; win% sort if unavailable.
    let order = {};
    try {
      const { games } = await buildLeagueGames(year || getNFLSeasonYear());
      order = currentStandings(
        rows.map((r) => ({ code: r.code, conference: r.conference, division: r.division, power: 1500 })),
        games
      );
    } catch (_err) {
      order = {};
    }

    const grouped = buildStandingsByConference(rows);
    const result = Object.entries(grouped).reduce((acc, [conference, divisions]) => {
      acc[conference] = Object.entries(divisions).reduce((divisionAcc, [division, teamsInDivision]) => {
        divisionAcc[division] = buildDivisionStandings(teamsInDivision, order);
        return divisionAcc;
      }, {});
      return acc;
    }, {});

    res.json({ success: true, year: year || getNFLSeasonYear(), standings: result });
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

    await attachElo(rows, year);
    const divisions = buildDivisionPower(rows)
      .sort((a, b) =>
        (b.averagePower ?? 0) - (a.averagePower ?? 0) ||
        b.averageTSI - a.averageTSI ||
        b.averageWinPct - a.averageWinPct);

    res.json({ success: true, year: year || getNFLSeasonYear(), divisions });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* Legacy playoff score, used only when the league simulation is unavailable. */
function computePlayoffProbability(team) {
  const winPct = team.record.winPct || 0;
  const pointDiff = team.averages.pointDiffPerGame || 0;
  const base = winPct * 100;
  // Injuries only touch the games still to play.
  const played = (team.record.wins || 0) + (team.record.losses || 0) + (team.record.ties || 0);
  const remainingShare = Math.max(0, 17 - played) / 17;
  const injury = injuryWinShift(team) * 100 * remainingShare;
  const adjusted = base + (team.tsi - 50) * 0.55 + pointDiff * 2.2 + injury;
  return Number(Math.max(5, Math.min(99, Math.round(adjusted * 10) / 10)).toFixed(1));
}

function buildPlayoffPulse(rows, simByCode = {}) {
  return rows
    .map((team) => ({
      code: team.code,
      name: team.name,
      conference: team.conference,
      division: team.division,
      record: team.record,
      tsi: team.tsi,
      averagePointDiff: Number(team.averages.pointDiffPerGame.toFixed(1)),
      playoffProbability: computePlayoffProbability(team),
      ...simOdds(simByCode[team.code]),
      source: simByCode[team.code] ? "league-simulation" : "legacy-formula"
    }))
    .sort((a, b) => b.playoffProbability - a.playoffProbability || b.tsi - a.tsi);
}

/**
 * Left team hosts. With Elo on both sides this is the model's own game
 * forecast (well calibrated in the 2012-25 backtest), and the margin uses the
 * 25-Elo-per-point convention. The strength-blend curve below is only the
 * fallback when ratings are unavailable.
 */
function simulateMatchup(left, right) {
  if (Number.isFinite(left._elo) && Number.isFinite(right._elo)) {
    const diff = left._elo + ELO_HOME_FIELD - right._elo;
    const expectedMargin = Number(Math.max(-21, Math.min(21, diff / 25)).toFixed(1));
    const p = Math.max(0.02, Math.min(0.98, eloWinProb(left._elo, right._elo, ELO_HOME_FIELD)));
    const homeWinProbability = Number((p * 100).toFixed(1));
    return {
      homeWinProbability,
      awayWinProbability: Number((100 - homeWinProbability).toFixed(1)),
      expectedMargin,
      source: "elo"
    };
  }

  const leftScore = teamStrength(left);
  const rightScore = teamStrength(right);
  // teamStrength is an internal rating scale, not a football point spread.
  // Convert it to projected points, include a modest home-field edge, and
  // bound the result so even extreme data cannot produce absurd margins.
  const rawMargin = (leftScore - rightScore) / 6.5 + 1.5;
  const expectedMargin = Number(Math.max(-21, Math.min(21, rawMargin)).toFixed(1));
  // Use a deliberately conservative curve: model estimates should express
  // uncertainty instead of presenting NFL matchups as near-certainties.
  const winProb = 1 / (1 + Math.exp(-expectedMargin / 8.5));
  const winProbability = Number((Math.max(0.1, Math.min(0.9, winProb)) * 100).toFixed(1));
  return {
    homeWinProbability: winProbability,
    awayWinProbability: Number((100 - winProbability).toFixed(1)),
    expectedMargin,
    source: "strength-blend"
  };
}

function buildMatchupResponse(left, right, year, simByCode = {}) {
  const matchup = simulateMatchup(left, right);
  const teams = [left, right].map((team) => ({
    ...team,
    averagePointDiff: Number((team.averages?.pointDiffPerGame || 0).toFixed(1)),
    playoffProbability: computePlayoffProbability(team),
    ...simOdds(simByCode[team.code])
  }));

  return {
    success: true,
    year: year || getNFLSeasonYear(),
    teams,
    matchup,
    // Keep the result available at the top level for existing clients.
    ...matchup
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
      // Difficulty = how often an average (1500 Elo) team would LOSE these
      // exact games, at these venues: 50 is an average slate, higher is
      // harder. The old score rose with games left and fell with the team's
      // own point differential, neither of which is about the opponents.
      const lossShares = remainingGames.map((game) => {
        const home = String(game.homeTeamAbbr || "").toUpperCase();
        const opponent = home === team.code ? String(game.awayTeamAbbr || "").toUpperCase() : home;
        const oppElo = teamIndex.get(opponent)?._elo;
        if (!Number.isFinite(oppElo)) return null;
        const hfa = game.neutralSite ? 0 : home === team.code ? ELO_HOME_FIELD : -ELO_HOME_FIELD;
        return 1 - eloWinProb(ELO_BASE, oppElo, hfa);
      }).filter((x) => x != null);
      const strengthScore = lossShares.length
        ? Number(((lossShares.reduce((a, b) => a + b, 0) / lossShares.length) * 100).toFixed(1))
        : Number(Math.max(0, Math.min(100, 50 + (averageOpponentTsi - 50) * 0.6)).toFixed(1));

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

    const [simByCode] = await Promise.all([getSimulationByTeam({ year }), attachInjuries(rows, year)]);
    const forecast = buildForecast(rows, simByCode);
    res.json({ success: true, year: year || getNFLSeasonYear(), forecast });
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

    await attachElo(rows, year);
    const scheduleStrength = buildScheduleStrength(rows);
    res.json({ success: true, year: year || getNFLSeasonYear(), scheduleStrength });
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

    const [simByCode] = await Promise.all([getSimulationByTeam({ year }), attachInjuries(rows, year)]);
    const pulse = buildPlayoffPulse(rows, simByCode);
    res.json({ success: true, year: year || getNFLSeasonYear(), pulse });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ---------------------------------------------------------------------------
   Playoff bracket builder
   Seeds come from the league season simulation's most likely bracket (each
   division to its most frequent winner, then the best remaining playoff odds).
   Each game shows the Elo win probability and the favorite advances. Without
   a simulation it falls back to seeding by the legacy strength blend.
   Returns the same shape the PlayoffBracket UI uses.
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

/* probability the first team beats the second; Elo when both teams carry it */
function matchupProbability(teamA, teamB, homeBump = 0) {
  if (Number.isFinite(teamA._elo) && Number.isFinite(teamB._elo)) {
    return eloWinProb(teamA._elo, teamB._elo, homeBump ? ELO_HOME_FIELD : 0);
  }
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

function buildConferenceBracket(confRows, seedCodes = null) {
  const byCode = new Map(confRows.map((t) => [t.code, t]));
  const projected = (seedCodes || []).map((code) => byCode.get(code)).filter(Boolean);
  const seeds = projected.length === 7 ? projected : legacySeeds(confRows);
  return playBracket(seeds);
}

function legacySeeds(confRows) {
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

  return [...divisionWinners, ...wildcards];
}

function playBracket(seeds) {
  seeds.forEach((team, i) => { team._seed = i + 1; });
  const s = (n) => seeds[n - 1];

  /* need a full 7-team field to build a standard bracket */
  if (seeds.length < 7 || seeds.some((t) => !t)) return null;

  /* Wild Card round: 2v7, 3v6, 4v5 (1 seed byes) */
  const wc1 = makeGame(s(2), s(7));
  const wc2 = makeGame(s(3), s(6));
  const wc3 = makeGame(s(4), s(5));

  /* Divisional round, reseeded as the NFL does:
       slot 0 (top)    = the other two survivors
       slot 1 (bottom) = 1-seed vs the lowest surviving seed */
  const survivors = [wc1._winner, wc2._winner, wc3._winner].sort((a, b) => a._seed - b._seed);
  const d0 = makeGame(...orderBySeed(survivors[0], survivors[1]));
  const d1 = makeGame(...orderBySeed(s(1), survivors[2]));

  /* Conference Championship */
  const cc = makeGame(...orderBySeed(d0._winner, d1._winner));

  return {
    championship: stripGame(cc),
    divisional: [stripGame(d0), stripGame(d1)],
    wildCard: [stripGame(wc1), stripGame(wc2), stripGame(wc3)],
    champion: cc._winner
  };
}

function buildPlayoffBracket(rows, year, projectedSeeds = null) {
  const afcRows = rows.filter((t) => t.conference === "AFC");
  const nfcRows = rows.filter((t) => t.conference === "NFC");
  const codes = (conf) => projectedSeeds?.[conf]?.map((t) => t.code) || null;

  const afc = buildConferenceBracket(afcRows, codes("AFC"));
  const nfc = buildConferenceBracket(nfcRows, codes("NFC"));

  if (!afc || !nfc) return null;

  /* super bowl is neutral-site, so no home bump; labels are by conference */
  const afcProb = Math.round(matchupProbability(afc.champion, nfc.champion, 0) * 100);

  return {
    year: year || getNFLSeasonYear(),
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
    const [sim] = await Promise.all([
      getSeasonSimulation({ year }).catch(() => null),
      attachElo(rows, year)
    ]);

    const bracket = buildPlayoffBracket(rows, year, sim?.projectedSeeds);
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
    const team1 = teamOr400(res, req.query.team1, "DAL");
    if (!team1) return;
    const team2 = teamOr400(res, req.query.team2, "PHI");
    if (!team2) return;
    const year = Number(req.query.year) || undefined;
    const left = await fetchTeamSummary(team1, year);
    const right = await fetchTeamSummary(team2, year);
    const [simByCode] = await Promise.all([
      getSimulationByTeam({ year }),
      attachElo([left, right], year),
      attachInjuries([left, right], year)
    ]);
    res.json(buildMatchupResponse(left, right, year, simByCode));
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/compare", async (req, res) => {
  try {
    const team1 = teamOr400(res, req.query.team1, "DAL");
    if (!team1) return;
    const team2 = teamOr400(res, req.query.team2, "PHI");
    if (!team2) return;
    const year = Number(req.query.year) || undefined;

    const left = await fetchTeamSummary(team1, year);
    const right = await fetchTeamSummary(team2, year);
    const headToHead = findHeadToHeadGames(team1, team2, left.games);
    const difference = summarizeComparison(left, right);

    res.json({ success: true, year: year || getNFLSeasonYear(), teams: [left, right], difference, headToHead });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/rivalimpact", async (req, res) => {
  try {
    const team = teamOr400(res, req.query.team);
    if (!team) return;
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

router.buildMatchupResponse = buildMatchupResponse;
router.buildForecast = buildForecast;
router.buildPlayoffPulse = buildPlayoffPulse;
router.buildPlayoffBracket = buildPlayoffBracket;
router.buildDivisionStandings = buildDivisionStandings;

module.exports = router;

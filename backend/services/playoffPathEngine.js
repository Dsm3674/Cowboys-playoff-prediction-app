"use strict";

/**
 * playoffPathEngine
 * Conditional playoff paths on top of the league season simulator.
 *
 * Beyond flat Super Bowl percentages, every simulated bracket is logged as a
 * joint outcome, which lets us answer path questions:
 *   - P(team wins SB | opposite-conference #1 seed is upset before the SB)
 *     — i.e. who actually benefits from chaos in the other conference
 *   - P(team wins SB | specific SB opponent)
 *   - round-by-round survival for the focus team, including missing the
 *     playoffs entirely
 *
 * The field is not fixed: each iteration plays out the rest of the regular
 * season first (services/seasonSimulator.js), so the seeds, and who holds the
 * #1 seed, change from one simulated season to the next.
 */

const { mulberry32 } = require("./bracketCore");
const { simulateSeason, projectSeeds } = require("./seasonSimulator");

const DEFAULT_ITERATIONS = 25000;
const MIN_ITERATIONS = 1000;
const MAX_ITERATIONS = 100000;

function clampIterations(n) {
  const v = Number(n) || DEFAULT_ITERATIONS;
  return Math.max(MIN_ITERATIONS, Math.min(MAX_ITERATIONS, Math.floor(v)));
}

/* ── Seeding ───────────────────────────────────────────────────────────── */

function seedSort(a, b) {
  const pct = (b.record?.winPct || 0) - (a.record?.winPct || 0);
  if (pct !== 0) return pct;
  const diff = (b.pointDiffPerGame || 0) - (a.pointDiffPerGame || 0);
  if (diff !== 0) return diff;
  return (b.power || 0) - (a.power || 0);
}

/** Seven seeds per conference: 4 division winners then 3 wild cards. */
function seedConference(rows) {
  const byDivision = rows.reduce((acc, t) => {
    (acc[t.division] = acc[t.division] || []).push(t);
    return acc;
  }, {});

  const divisionWinners = Object.values(byDivision)
    .map((list) => list.slice().sort(seedSort)[0])
    .filter(Boolean)
    .sort(seedSort)
    .slice(0, 4);

  const winnerCodes = new Set(divisionWinners.map((t) => t.code));
  const wildcards = rows
    .filter((t) => !winnerCodes.has(t.code))
    .sort(seedSort)
    .slice(0, 3);

  const seeds = [...divisionWinners, ...wildcards];
  if (seeds.length < 7) return null;
  return seeds.map((team, i) => ({ ...team, seed: i + 1 }));
}

/* ── Full path simulation with joint-outcome tracking ──────────────────── */

async function simulatePlayoffPaths({
  year,
  focusTeam = "DAL",
  iterations = DEFAULT_ITERATIONS,
  seed = 20260120,
  ratingsOverride = null, // test hook: inject a ratings table
  gamesOverride = null,
} = {}) {
  const focus = String(focusTeam || "DAL").toUpperCase();
  const iters = clampIterations(iterations);

  const winSBGivenOppUpset = {};       // code -> SB wins when the other conf's #1 fell
  const oppTopUpsetTotal = {};         // conference -> iterations its #1 seed missed the SB
  const topSeedCounts = {};            // conference -> code -> times seeded #1
  const focusOppBreakdown = {};        // SB opponent code -> { met, beat }
  const focusRoundExits = { MISSED: 0, WILD_CARD: 0, DIVISIONAL: 0, CONF_CHAMPIONSHIP: 0, SB_LOSS: 0, SB_WIN: 0 };

  const onIteration = ({ byConf, sbWinner, conferences }) => {
    const upset = {};
    for (const c of conferences) {
      const top = byConf[c].seeds[0].code;
      topSeedCounts[c] = topSeedCounts[c] || {};
      topSeedCounts[c][top] = (topSeedCounts[c][top] || 0) + 1;
      upset[c] = byConf[c].result.champion.code !== top;
      if (upset[c]) oppTopUpsetTotal[c] = (oppTopUpsetTotal[c] || 0) + 1;
    }

    // Credit the SB winner when the *other* conference's #1 seed fell.
    const winnerConf = conferences.find((c) => byConf[c].result.champion === sbWinner);
    const otherConf = conferences.find((c) => c !== winnerConf);
    if (upset[otherConf]) {
      winSBGivenOppUpset[sbWinner.code] = (winSBGivenOppUpset[sbWinner.code] || 0) + 1;
    }

    const focusConf = conferences.find((c) => byConf[c].seeds.some((t) => t.code === focus));
    if (!focusConf) {
      focusRoundExits.MISSED++;
      return;
    }
    const res = byConf[focusConf].result;
    if (res.champion.code === focus) {
      const opp = byConf[conferences.find((c) => c !== focusConf)].result.champion.code;
      focusOppBreakdown[opp] = focusOppBreakdown[opp] || { met: 0, beat: 0 };
      focusOppBreakdown[opp].met++;
      if (sbWinner.code === focus) {
        focusOppBreakdown[opp].beat++;
        focusRoundExits.SB_WIN++;
      } else {
        focusRoundExits.SB_LOSS++;
      }
    } else {
      focusRoundExits[res.eliminatedRound[focus]]++;
    }
  };

  const sim = await simulateSeason({
    year, iterations: iters, seed, ratingsOverride, gamesOverride, onIteration,
  });

  const pct = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(2)) : 0);
  const projected = projectSeeds(sim.teams);
  const projectedSeedOf = Object.fromEntries(
    Object.values(projected).flat().map((t) => [t.code, t.seed])
  );
  const conferences = Object.keys(projected);
  const otherConf = (c) => conferences.find((x) => x !== c);

  const teams = sim.teams
    .filter((t) => t.playoffPct > 0)
    .map((t) => {
      const baseline = t.winSBPct;
      const conditional = pct(winSBGivenOppUpset[t.code] || 0, oppTopUpsetTotal[otherConf(t.conference)] || 0);
      return {
        code: t.code,
        name: t.name,
        conference: t.conference,
        seed: projectedSeedOf[t.code] ?? null,
        power: t.power,
        playoffPct: t.playoffPct,
        divisionPct: t.divisionPct,
        byePct: t.byePct,
        reachCCPct: t.reachCCPct,
        reachSBPct: t.reachSBPct,
        winSBPct: baseline,
        winSBGivenOppUpsetPct: conditional,
        upsetLiftPts: Number((conditional - baseline).toFixed(2)),
      };
    })
    .sort((a, b) => b.winSBPct - a.winSBPct);

  const opponentBreakdown = Object.entries(focusOppBreakdown)
    .map(([code, v]) => ({
      opponent: code,
      meetSBPct: pct(v.met, sim.iterations),
      winSBGivenOpponentPct: pct(v.beat, v.met),
      jointWinPct: pct(v.beat, sim.iterations),
    }))
    .sort((a, b) => b.meetSBPct - a.meetSBPct);

  const modalTopSeed = (c) =>
    Object.entries(topSeedCounts[c] || {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const focusStats = sim.teams.find((t) => t.code === focus);

  return {
    year: sim.year,
    iterations: sim.iterations,
    seed,
    engine: sim.engine,
    ratingsUpdatedAt: sim.ratingsUpdatedAt,
    lastCompletedWeek: sim.lastCompletedWeek,
    gamesRemaining: sim.gamesRemaining,
    topSeeds: Object.fromEntries(conferences.map((c) => [c, modalTopSeed(c)])),
    focusTeam: focus,
    focusInField: Boolean(focusStats && focusStats.playoffPct > 0),
    focusPlayoffPct: focusStats ? focusStats.playoffPct : 0,
    focusRoundExits,
    opponentBreakdown,
    teams,
    seeds: projected,
  };
}

module.exports = {
  DEFAULT_ITERATIONS,
  MAX_ITERATIONS,
  simulatePlayoffPaths,
  seedConference,
  mulberry32,
  _internals: { clampIterations },
};

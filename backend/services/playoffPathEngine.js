"use strict";

/**
 * playoffPathEngine
 * Monte Carlo playoff simulator built on the Elo power ratings.
 *
 * Beyond flat Super Bowl percentages, every simulated bracket is logged as a
 * joint outcome, which lets us answer path questions:
 *   - P(team wins SB | opposite-conference #1 seed is upset before the SB)
 *     — i.e. who actually benefits from chaos in the other conference
 *   - P(team wins SB | specific SB opponent)
 *   - round-by-round survival for the focus team
 *
 * The bracket uses real NFL rules: seeds 2v7/3v6/4v5 with a 1-seed bye,
 * reseeding after the wild-card round (1 seed hosts the lowest survivor),
 * higher seed hosts through the conference championship, neutral-site SB.
 */

const { eloWinProb, ELO_HOME_FIELD, getPowerRatings } = require("./ratingsEngine");

const DEFAULT_ITERATIONS = 25000;
const MIN_ITERATIONS = 1000;
const MAX_ITERATIONS = 100000;

/* Deterministic RNG so runs are reproducible under a seed. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/* ── Single-bracket simulation ─────────────────────────────────────────── */

function playGame(home, away, rand, neutral = false) {
  const p = eloWinProb(home.power, away.power, neutral ? 0 : ELO_HOME_FIELD);
  return rand() < p ? home : away;
}

/** Returns { champion, eliminatedRound: {code: round} } for one conference. */
function playConference(seeds, rand) {
  const out = {};
  const s = (n) => seeds[n - 1];

  const wcWinners = [
    playGame(s(2), s(7), rand),
    playGame(s(3), s(6), rand),
    playGame(s(4), s(5), rand),
  ];
  for (const team of seeds.slice(1)) {
    if (!wcWinners.includes(team)) out[team.code] = "WILD_CARD";
  }

  // Reseed: 1 seed hosts the lowest remaining seed; other two pair off.
  const remaining = [s(1), ...wcWinners].sort((a, b) => a.seed - b.seed);
  const divWinners = [
    playGame(remaining[0], remaining[3], rand),
    playGame(remaining[1], remaining[2], rand),
  ];
  for (const team of remaining) {
    if (!divWinners.includes(team)) out[team.code] = "DIVISIONAL";
  }

  const [ccHome, ccAway] = divWinners.sort((a, b) => a.seed - b.seed);
  const champion = playGame(ccHome, ccAway, rand);
  const loser = champion === ccHome ? ccAway : ccHome;
  out[loser.code] = "CONF_CHAMPIONSHIP";

  return { champion, eliminatedRound: out };
}

/* ── Full path simulation with joint-outcome tracking ──────────────────── */

async function simulatePlayoffPaths({
  year,
  focusTeam = "DAL",
  iterations = DEFAULT_ITERATIONS,
  seed = 20260120,
  ratingsOverride = null, // test hook: inject a ratings table
} = {}) {
  const ratings = ratingsOverride || (await getPowerRatings({ year }));
  const focus = String(focusTeam || "DAL").toUpperCase();
  const iters = clampIterations(iterations);
  const rand = mulberry32(seed);

  const afcSeeds = seedConference(ratings.ratings.filter((t) => t.conference === "AFC"));
  const nfcSeeds = seedConference(ratings.ratings.filter((t) => t.conference === "NFC"));
  if (!afcSeeds || !nfcSeeds) {
    throw new Error("Not enough seeded teams to build both conference brackets.");
  }

  const field = [...afcSeeds, ...nfcSeeds];
  const conferenceOf = Object.fromEntries(field.map((t) => [t.code, t.conference]));
  const afcTop = afcSeeds[0].code;
  const nfcTop = nfcSeeds[0].code;

  const counts = {};
  for (const t of field) {
    counts[t.code] = {
      reachCC: 0, reachSB: 0, winSB: 0,
      winSBGivenOppTopUpset: 0, oppTopUpsetTotal: 0,
    };
  }

  const focusOppBreakdown = {}; // SB opponent code -> { met, beat }
  let focusRoundExits = { WILD_CARD: 0, DIVISIONAL: 0, CONF_CHAMPIONSHIP: 0, SB_LOSS: 0, SB_WIN: 0, MISSED: 0 };
  const focusInField = field.some((t) => t.code === focus);

  for (let i = 0; i < iters; i++) {
    const afc = playConference(afcSeeds, rand);
    const nfc = playConference(nfcSeeds, rand);
    const sbWinner = playGame(afc.champion, nfc.champion, rand, true);
    const sbLoser = sbWinner === afc.champion ? nfc.champion : afc.champion;

    const afcTopUpset = afc.champion.code !== afcTop;   // AFC #1 failed to reach SB
    const nfcTopUpset = nfc.champion.code !== nfcTop;

    for (const t of field) {
      const c = counts[t.code];
      const conf = conferenceOf[t.code];
      const res = conf === "AFC" ? afc : nfc;
      const exitRound = res.eliminatedRound[t.code];

      if (exitRound === undefined || exitRound === "CONF_CHAMPIONSHIP") c.reachCC++;
      if (res.champion.code === t.code) c.reachSB++;
      if (sbWinner.code === t.code) c.winSB++;

      // "Upset in the other conference": their #1 seed missed the SB.
      const oppUpset = conf === "AFC" ? nfcTopUpset : afcTopUpset;
      if (oppUpset) {
        c.oppTopUpsetTotal++;
        if (sbWinner.code === t.code) c.winSBGivenOppTopUpset++;
      }
    }

    if (focusInField) {
      const conf = conferenceOf[focus];
      const res = conf === "AFC" ? afc : nfc;
      const exit = res.eliminatedRound[focus];
      if (res.champion.code === focus) {
        const opp = conf === "AFC" ? nfc.champion.code : afc.champion.code;
        focusOppBreakdown[opp] = focusOppBreakdown[opp] || { met: 0, beat: 0 };
        focusOppBreakdown[opp].met++;
        if (sbWinner.code === focus) {
          focusOppBreakdown[opp].beat++;
          focusRoundExits.SB_WIN++;
        } else {
          focusRoundExits.SB_LOSS++;
        }
      } else {
        focusRoundExits[exit] = (focusRoundExits[exit] || 0) + 1;
      }
    } else {
      focusRoundExits.MISSED++;
    }
  }

  const pct = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(2)) : 0);

  const teams = field.map((t) => {
    const c = counts[t.code];
    const baseline = pct(c.winSB, iters);
    const conditional = pct(c.winSBGivenOppTopUpset, c.oppTopUpsetTotal);
    return {
      code: t.code,
      name: t.name,
      conference: t.conference,
      seed: t.seed,
      power: t.power,
      reachCCPct: pct(c.reachCC, iters),
      reachSBPct: pct(c.reachSB, iters),
      winSBPct: baseline,
      winSBGivenOppUpsetPct: conditional,
      upsetLiftPts: Number((conditional - baseline).toFixed(2)),
    };
  }).sort((a, b) => b.winSBPct - a.winSBPct);

  const opponentBreakdown = Object.entries(focusOppBreakdown)
    .map(([code, v]) => ({
      opponent: code,
      meetSBPct: pct(v.met, iters),
      winSBGivenOpponentPct: pct(v.beat, v.met),
      jointWinPct: pct(v.beat, iters),
    }))
    .sort((a, b) => b.meetSBPct - a.meetSBPct);

  return {
    year: ratings.year,
    iterations: iters,
    seed,
    engine: "Elo-driven bracket · NFL reseeding · neutral-site SB",
    ratingsUpdatedAt: ratings.updatedAt,
    lastCompletedWeek: ratings.lastCompletedWeek,
    topSeeds: { AFC: afcTop, NFC: nfcTop },
    focusTeam: focus,
    focusInField,
    focusRoundExits,
    opponentBreakdown,
    teams,
    seeds: {
      AFC: afcSeeds.map((t) => ({ seed: t.seed, code: t.code, name: t.name, power: t.power })),
      NFC: nfcSeeds.map((t) => ({ seed: t.seed, code: t.code, name: t.name, power: t.power })),
    },
  };
}

module.exports = {
  DEFAULT_ITERATIONS,
  MAX_ITERATIONS,
  simulatePlayoffPaths,
  seedConference,
  mulberry32,
  _internals: { playConference, playGame, clampIterations },
};

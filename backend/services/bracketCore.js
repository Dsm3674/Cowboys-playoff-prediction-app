"use strict";

/**
 * bracketCore
 * Playoff bracket primitives shared by the season simulator and the path
 * engine: a seedable RNG and one conference's postseason under NFL rules
 * (2v7/3v6/4v5 with a 1-seed bye, reseeding after the wild-card round, higher
 * seed hosts through the conference championship).
 */

const { eloWinProb, ELO_HOME_FIELD } = require("./ratingsEngine");

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

function playGame(home, away, rand, neutral = false) {
  const p = eloWinProb(home.power, away.power, neutral ? 0 : ELO_HOME_FIELD);
  return rand() < p ? home : away;
}

/**
 * One conference's postseason. `seeds` is seven teams with `seed` 1..7, a
 * `code` and a `power`. Returns { champion, eliminatedRound: {code: round} }.
 */
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

module.exports = { mulberry32, playGame, playConference };

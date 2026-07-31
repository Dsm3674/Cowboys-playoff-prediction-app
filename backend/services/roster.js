"use strict";

/**
 * roster
 * Builds the play-by-play matching table the analytics engines scan with.
 *
 * This replaces the hand-written ROSTER_MAP that used to live in
 * routes/players.js. That list carried 48 players with hand-typed regexes, and
 * nothing kept it in step with the actual roster — by the time it was checked,
 * 29 of its 48 entries had left the team and 71 of the 90 players on the roster
 * had no entry at all. Since a player with no pattern can never accumulate a
 * snap, the clutch index and the performance map could never show more than 19
 * of 90 players no matter how many games were played.
 *
 * Everything here is derived from Data/roster.js, so adding a player to the
 * roster is all it takes to make them visible to every engine.
 */

const ROSTER = require("../Data/roster");

/* Position → side of the ball. The engines score each side differently:
   skill players on yards and touchdowns, the line on penalties avoided,
   defenders on disruption, specialists on kicking. */
const SIDE_BY_POSITION = {
  QB: "offense", RB: "offense", FB: "offense", WR: "offense", TE: "offense",
  OT: "oline", OG: "oline", G: "oline", C: "oline", OL: "oline", T: "oline",
  DE: "defense", DT: "defense", NT: "defense", EDGE: "defense",
  LB: "defense", ILB: "defense", OLB: "defense", MLB: "defense",
  CB: "defense", DB: "defense", S: "defense", SAF: "defense",
  FS: "defense", SS: "defense",
  K: "special", P: "special", LS: "special",
};

const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip a generational suffix so "John Stephens Jr." keys off "Stephens". */
function splitName(fullName) {
  const parts = String(fullName).trim().split(/\s+/);
  while (parts.length > 2 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ") || first;
  return { first, last };
}

/** Stable slug for a player, unique across the roster. */
function slugify(fullName) {
  return String(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Patterns ESPN play-by-play actually uses for a name.
 *
 * Their feed abbreviates to "D.Prescott" in play text but spells names out in
 * some fields, so both are matched. A name whose first token is already an
 * initial cluster ("TJ Bass") also gets its dotted form ("T.J.Bass"), which is
 * how the feed renders it.
 */
function buildPattern(fullName) {
  const { first, last } = splitName(fullName);
  const lastEsc = escapeRegex(last);
  const alternatives = new Set();

  alternatives.add(`${escapeRegex(first)}\\s+${lastEsc}`);          // dak prescott
  if (first) {
    alternatives.add(`${escapeRegex(first[0])}\\.\\s?${lastEsc}`);  // d.prescott / d. prescott
  }
  /* "TJ" → "t\.j\." so TJ Bass matches the feed's T.J.Bass */
  if (/^[a-z]{2,3}$/i.test(first)) {
    const dotted = first.split("").map((ch) => `${escapeRegex(ch)}\\.`).join("");
    alternatives.add(`${dotted}\\s?${lastEsc}`);
  }

  return new RegExp(`\\b(${[...alternatives].join("|")})\\b`, "i");
}

/**
 * The roster as the engines consume it: an id, display fields, the side of the
 * ball, and a compiled matcher.
 */
function buildRosterMap(roster = ROSTER) {
  const seen = new Map();
  return roster.map((player) => {
    let id = slugify(player.name);
    /* Two players can slug identically; keep ids unique so per-player stat
       buckets never collide. */
    const count = (seen.get(id) || 0) + 1;
    seen.set(id, count);
    if (count > 1) id = `${id}-${count}`;

    return {
      id,
      name: player.name,
      pos: player.pos,
      number: player.num,
      role: player.status === "Healthy" ? "Active" : player.status,
      rating: player.rating,
      side: SIDE_BY_POSITION[player.pos] || "offense",
      regex: buildPattern(player.name),
    };
  });
}

const ROSTER_MAP = buildRosterMap();

module.exports = {
  ROSTER,
  ROSTER_MAP,
  buildRosterMap,
  buildPattern,
  splitName,
  slugify,
  SIDE_BY_POSITION,
};

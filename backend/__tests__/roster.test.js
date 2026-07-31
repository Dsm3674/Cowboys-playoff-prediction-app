"use strict";

const fs = require("fs");
const path = require("path");

const ROSTER = require("../Data/roster");
const {
  ROSTER_MAP,
  buildRosterMap,
  buildPattern,
  splitName,
  slugify,
  SIDE_BY_POSITION,
} = require("../services/roster");

const SEED_SQL = path.join(__dirname, "..", "Data", "seed.sql");

/** The same roster rows the database gets seeded with. */
function parseSeedRoster() {
  const sql = fs.readFileSync(SEED_SQL, "utf8");
  return [...sql.matchAll(/\(\s*'([^']+)'\s*,\s*'([A-Z]{1,3})'\s*,\s*(\d+)\s*,\s*'([^']*)'/g)]
    .map((m) => ({ name: m[1], pos: m[2], num: Number(m[3]) }));
}

describe("roster — stays in sync with the seed", () => {
  /* This is the guard against the failure that motivated the whole module.
     The previous roster lived as 48 hand-typed regexes inside a route file and
     nothing checked it, so when the 90-man roster landed in seed.sql the two
     drifted apart in silence: 29 mapped players had left the team, and 71 real
     players had no entry, capping the clutch and map pages at 19 of 90. */
  const seed = parseSeedRoster();

  test("the seed roster parses", () => {
    expect(seed.length).toBeGreaterThanOrEqual(50);
  });

  test("every seeded player is in the roster module", () => {
    const known = new Set(ROSTER.map((p) => p.name.toLowerCase()));
    const missing = seed.filter((p) => !known.has(p.name.toLowerCase()));
    expect(missing.map((p) => p.name)).toEqual([]);
  });

  test("the roster module invents nobody", () => {
    const seeded = new Set(seed.map((p) => p.name.toLowerCase()));
    const extra = ROSTER.filter((p) => !seeded.has(p.name.toLowerCase()));
    expect(extra.map((p) => p.name)).toEqual([]);
  });

  test("positions and numbers match the seed", () => {
    const bySeedName = new Map(seed.map((p) => [p.name.toLowerCase(), p]));
    for (const player of ROSTER) {
      const match = bySeedName.get(player.name.toLowerCase());
      expect(match).toBeDefined();
      expect(player.pos).toBe(match.pos);
      expect(player.num).toBe(match.num);
    }
  });
});

describe("roster — derived match table", () => {
  test("every roster player gets an entry", () => {
    expect(ROSTER_MAP).toHaveLength(ROSTER.length);
  });

  test("ids are unique, so per-player stat buckets cannot collide", () => {
    const ids = ROSTER_MAP.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("duplicate names still get distinct ids", () => {
    const map = buildRosterMap([
      { name: "Sam Smith", pos: "WR", num: 1, status: "Healthy", rating: 70 },
      { name: "Sam Smith", pos: "CB", num: 2, status: "Healthy", rating: 70 },
    ]);
    expect(map[0].id).not.toBe(map[1].id);
  });

  test("every position maps to a known side of the ball", () => {
    for (const player of ROSTER) {
      expect(SIDE_BY_POSITION[player.pos]).toBeDefined();
    }
  });

  test("all four sides of the ball are represented", () => {
    const sides = new Set(ROSTER_MAP.map((p) => p.side));
    expect([...sides].sort()).toEqual(["defense", "offense", "oline", "special"]);
  });
});

describe("roster — play-by-play patterns", () => {
  const find = (text) => ROSTER_MAP.filter((p) => p.regex.test(text)).map((p) => p.name);

  test("matches the abbreviated form ESPN uses in play text", () => {
    expect(find("(12:45) D.Prescott pass short right to C.Lamb for 12 yards"))
      .toEqual(expect.arrayContaining(["Dak Prescott", "CeeDee Lamb"]));
  });

  test("matches full names", () => {
    expect(find("Israel Abanikanda up the middle for 3 yards"))
      .toContain("Israel Abanikanda");
  });

  test("matches a tackler credited in parentheses", () => {
    expect(find("(3:01) J.Blue right guard for 5 yards (M.Bell)"))
      .toEqual(expect.arrayContaining(["Jaydon Blue", "Markquese Bell"]));
  });

  test("handles an initial-cluster first name", () => {
    expect(find("T.J.Bass reported in as eligible")).toContain("TJ Bass");
  });

  test("a generational suffix keys off the surname", () => {
    const pattern = buildPattern("John Stephens Jr.");
    expect(pattern.test("J.Stephens for 8 yards")).toBe(true);
    expect(splitName("John Stephens Jr.")).toEqual({ first: "John", last: "Stephens" });
  });

  test("patterns are word-bounded, so a substring is not a match", () => {
    const pattern = buildPattern("Sam Williams");
    expect(pattern.test("D.Williamson pass incomplete")).toBe(false);
    expect(pattern.test("S.Williams sacked the quarterback")).toBe(true);
  });

  test("a name with regex characters is escaped, not interpreted", () => {
    const pattern = buildPattern("A.J. O'Brien-Smith");
    expect(() => pattern.test("anything")).not.toThrow();
    expect(pattern.test("A.J. O'Brien-Smith caught the pass")).toBe(true);
  });

  test("no player pattern matches an unrelated play", () => {
    expect(find("Timeout #1 by DAL at 02:00")).toEqual([]);
  });

  test("slugs are stable and url-safe", () => {
    expect(slugify("Dak Prescott")).toBe("dak-prescott");
    expect(slugify("A.J. O'Brien-Smith")).toBe("a-j-o-brien-smith");
  });
});

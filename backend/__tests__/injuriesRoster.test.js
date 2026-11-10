"use strict";

/* Injuries the league report no longer lists, and starters moved down the
   depth chart by their own injury. */

const {
  ELO_PER_POINT,
  POSITION_POINTS,
  parseDepthChart,
  parseRoster,
  mergeInjuries,
  scoreTeamInjuries,
  expectedGamesOut,
} = require("../services/injuries");

const NOW = Date.parse("2026-11-10T12:00:00Z");
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
const player = (id, displayName, pos, salary, injury, statusType = "active") => ({
  id,
  displayName,
  position: { abbreviation: pos },
  contract: { salary },
  status: { type: statusType },
  injuries: injury ? [injury] : [],
});

/* ESPN's order: healthy players first, then the injured. */
const depth = parseDepthChart({
  depthchart: [
    {
      name: "3WR 1TE",
      positions: {
        qb: {
          athletes: [
            { id: "10", displayName: "Journeyman QB" },
            { id: "11", displayName: "Rookie QB" },
            { id: "1", displayName: "Franchise QB" },
            { id: "12", displayName: "Camp QB" },
          ],
        },
        c: { athletes: [{ id: "20", displayName: "Starting Center" }, { id: "21", displayName: "Depth Center" }] },
      },
    },
  ],
});

const roster = parseRoster({
  athletes: [
    {
      position: "offense",
      items: [
        player("10", "Journeyman QB", "QB", 5000000),
        player("11", "Rookie QB", "QB", 900000),
        player("1", "Franchise QB", "QB", 50000000, { status: "Injured Reserve", date: daysAgo(30) }),
        player("12", "Camp QB", "QB", 600000, { status: "Injured Reserve", date: daysAgo(80) }),
        player("20", "Starting Center", "C", 4000000),
        player("21", "Depth Center", "C", 3000000, { status: "Injured Reserve", date: daysAgo(5) }),
        player("30", "Old Tag", "WR", 1000000, { status: "Questionable", date: daysAgo(60) }),
        player("31", "Fresh Tag", "WR", 1000000, { status: "Questionable", date: daysAgo(2) }),
      ],
    },
    {
      position: "practiceSquad",
      items: [player("40", "Squad Guy", "CB", 0, { status: "Out", date: daysAgo(1) }, "practice-squad")],
    },
  ],
});

describe("injuries — roster source", () => {
  test("lists every designated player with salaries, skipping the practice squad", () => {
    expect(roster.injured.map((p) => p.name)).toEqual(
      ["Franchise QB", "Camp QB", "Depth Center", "Old Tag", "Fresh Tag"]
    );
    expect(roster.salaryById["1"]).toBe(50000000);
  });

  test("the league report wins; the roster adds what it dropped", () => {
    const report = [
      { athleteId: null, name: "Fresh Tag", position: "WR", status: "Out", date: daysAgo(0), detail: "Knee" },
    ];
    const merged = mergeInjuries(report, roster.injured, { now: NOW });
    const fresh = merged.find((p) => p.name === "Fresh Tag");
    expect(fresh.status).toBe("Out");
    expect(fresh.detail).toBe("Knee");
    expect(fresh.athleteId).toBe("31");
    expect(merged.some((p) => p.name === "Franchise QB")).toBe(true);
  });

  test("a weeks-old game-status tag is dropped as a leftover", () => {
    const names = mergeInjuries([], roster.injured, { now: NOW }).map((p) => p.name);
    expect(names).not.toContain("Old Tag");
    expect(names).toContain("Fresh Tag");
  });

  test("a player the report shows as active is not revived from the roster", () => {
    const report = [{ athleteId: null, name: "Franchise QB", position: "QB", status: "Active", date: daysAgo(0) }];
    const merged = mergeInjuries(report, roster.injured, { now: NOW });
    expect(merged.filter((p) => p.name === "Franchise QB")).toHaveLength(1);
    expect(scoreTeamInjuries(merged, depth, { now: NOW, salaries: roster }).players
      .some((p) => p.name === "Franchise QB")).toBe(false);
  });
});

describe("injuries — starters displaced by their own injury", () => {
  const merged = mergeInjuries([], roster.injured, { now: NOW });
  const scored = scoreTeamInjuries(merged, depth, { now: NOW, salaries: roster });
  const find = (name) => scored.players.find((p) => p.name === name);

  test("an injured starter listed under his replacement is priced as a starter", () => {
    const qb = find("Franchise QB");
    expect(qb).toBeDefined();
    expect(qb.starter).toBe(true);
    // 30 days on IR: staleness has begun to fade the full QB cost.
    expect(qb.elo).toBeLessThan(-0.5 * POSITION_POINTS.QB * ELO_PER_POINT);
    expect(qb.elo).toBeGreaterThan(-POSITION_POINTS.QB * ELO_PER_POINT);
  });

  test("an injured backup behind him is not", () => {
    expect(find("Camp QB")).toBeUndefined();
  });

  test("an injured backup paid like the starter is not promoted", () => {
    expect(find("Depth Center")).toBeUndefined();
  });

  test("without salaries a lower-listed player stays a backup", () => {
    const res = scoreTeamInjuries(merged, depth, { now: NOW });
    expect(res.players.some((p) => p.name === "Franchise QB")).toBe(false);
  });

  test("with no depth chart, only recent injuries count", () => {
    const res = scoreTeamInjuries(merged, null, { now: NOW, salaries: roster });
    expect(res.players.map((p) => p.name).sort()).toEqual(["Depth Center", "Fresh Tag"]);
  });
});

describe("injuries — long-standing Out", () => {
  test("an Out that has stood for weeks is treated as long-term", () => {
    expect(expectedGamesOut({ status: "Out", date: daysAgo(40) }, NOW)).toBe(4);
    expect(expectedGamesOut({ status: "Out", date: daysAgo(2) }, NOW)).toBe(1);
  });
});

describe("injuries — news notes older than a designation", () => {
  test("a newer roster designation overrides an older news note", () => {
    const report = [{ athleteId: null, name: "Franchise QB", position: "QB", status: "Active", date: daysAgo(45) }];
    const merged = mergeInjuries(report, roster.injured, { now: NOW });
    expect(merged.find((p) => p.name === "Franchise QB").status).toBe("Injured Reserve");
  });
});

"use strict";

const {
  ELO_PER_POINT,
  TEAM_CAP_ELO,
  POSITION_POINTS,
  playProbability,
  stalenessWeight,
  parseInjuryReport,
  parseDepthChart,
  scoreTeamInjuries,
} = require("../services/injuries");
const { resolveInjuryDelta } = require("../services/ratingsEngine");

const NOW = Date.parse("2026-09-23T12:00:00Z");
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

const depthFixture = {
  depthchart: [
    {
      name: "3WR 1TE",
      positions: {
        qb: { athletes: [{ id: "1", displayName: "Dak Prescott" }, { id: "2", displayName: "Backup QB" }] },
        lt: { athletes: [{ id: "3", displayName: "Tyler Guyton" }] },
        wr: { athletes: [{ id: "4", displayName: "CeeDee Lamb" }] },
      },
    },
    {
      name: "Base 4-3 D",
      positions: { rde: { athletes: [{ id: "5", displayName: "Edge Guy" }] } },
    },
    {
      name: "Special Teams",
      positions: {
        pk: { athletes: [{ id: "6", displayName: "Brandon Aubrey" }] },
        kr: { athletes: [{ id: "7", displayName: "Returner" }] },
      },
    },
  ],
};

const injuryFixture = {
  injuries: [
    {
      id: "6",
      displayName: "Dallas Cowboys",
      injuries: [
        {
          status: "Out",
          date: daysAgo(2),
          athlete: { id: "1", displayName: "Dak Prescott", position: { abbreviation: "QB" } },
          details: { type: "Ankle" },
        },
        {
          status: "Questionable",
          date: daysAgo(1),
          athlete: { id: "4", displayName: "CeeDee Lamb", position: { abbreviation: "WR" } },
        },
      ],
    },
    {
      id: "21",
      displayName: "Philadelphia Eagles",
      injuries: [
        { status: "Doubtful", athlete: { id: "9", displayName: "X", position: { abbreviation: "CB" } } },
      ],
    },
  ],
};

describe("injuries — status and staleness", () => {
  test("maps report designations to play probability", () => {
    expect(playProbability("Out")).toBe(0);
    expect(playProbability("Injured Reserve")).toBe(0);
    expect(playProbability("Suspension")).toBe(0);
    expect(playProbability("Doubtful")).toBe(0.1);
    expect(playProbability("Questionable")).toBe(0.75);
    expect(playProbability("Active")).toBeNull();
    expect(playProbability("")).toBeNull();
  });

  test("staleness fades from full weight to 25%", () => {
    expect(stalenessWeight(daysAgo(7), NOW)).toBe(1);
    expect(stalenessWeight(daysAgo(35), NOW)).toBeCloseTo(0.625, 3);
    expect(stalenessWeight(daysAgo(90), NOW)).toBe(0.25);
    expect(stalenessWeight(null, NOW)).toBe(1);
  });
});

describe("injuries — parsing", () => {
  test("groups league report by team via id map", () => {
    const report = parseInjuryReport(injuryFixture, { 6: "DAL", 21: "PHI" });
    expect(Object.keys(report).sort()).toEqual(["DAL", "PHI"]);
    expect(report.DAL[0]).toMatchObject({ athleteId: "1", position: "QB", status: "Out", detail: "Ankle" });
  });

  test("depth chart keeps best rank and skips return slots", () => {
    const depth = parseDepthChart(depthFixture);
    expect(depth.byId["1"]).toEqual({ rank: 0, slot: "qb" });
    expect(depth.byId["2"].rank).toBe(1);
    expect(depth.byId["6"]).toEqual({ rank: 0, slot: "pk" });
    expect(depth.byId["7"]).toBeUndefined();
  });

  test("garbage payloads parse to empty", () => {
    expect(parseInjuryReport(null)).toEqual({});
    expect(parseDepthChart({ nope: 1 }).available).toBe(false);
  });
});

describe("injuries — scoring", () => {
  const depth = parseDepthChart(depthFixture);
  const report = parseInjuryReport(injuryFixture, { 6: "DAL", 21: "PHI" });

  test("starting QB out costs the full QB value", () => {
    const { delta, players } = scoreTeamInjuries(report.DAL, depth, { now: NOW });
    const qb = players.find((p) => p.position === "QB");
    expect(qb.elo).toBeCloseTo(-POSITION_POINTS.QB * ELO_PER_POINT, 1);
    const wr = players.find((p) => p.position === "WR");
    expect(wr.elo).toBeCloseTo(-0.25 * POSITION_POINTS.WR * ELO_PER_POINT, 1);
    expect(delta).toBeCloseTo(qb.elo + wr.elo, 1);
    expect(players[0].position).toBe("QB");
  });

  test("backups on the chart are ignored", () => {
    const res = scoreTeamInjuries(
      [{ athleteId: "2", name: "Backup QB", position: "QB", status: "Out", date: daysAgo(1) }],
      depth,
      { now: NOW }
    );
    expect(res.delta).toBe(0);
  });

  test("left tackle priced above a generic tackle", () => {
    const res = scoreTeamInjuries(
      [{ athleteId: "3", name: "Tyler Guyton", position: "OT", status: "Out", date: daysAgo(1) }],
      depth,
      { now: NOW }
    );
    expect(res.delta).toBeCloseTo(-0.9 * ELO_PER_POINT, 1);
  });

  test("recent off-chart non-QB counts at half weight, off-chart QB skipped", () => {
    const res = scoreTeamInjuries(
      [
        { athleteId: "50", name: "IR Corner", position: "CB", status: "Injured Reserve", date: daysAgo(5) },
        { athleteId: "51", name: "Old IR", position: "CB", status: "Injured Reserve", date: daysAgo(60) },
        { athleteId: "52", name: "IR QB", position: "QB", status: "Injured Reserve", date: daysAgo(5) },
      ],
      depth,
      { now: NOW }
    );
    expect(res.players).toHaveLength(1);
    expect(res.delta).toBeCloseTo(-0.5 * POSITION_POINTS.CB * ELO_PER_POINT, 0);
  });

  test("missing depth chart falls back to half weight for everyone", () => {
    const res = scoreTeamInjuries(report.PHI, null, { now: NOW });
    expect(res.delta).toBeCloseTo(-0.9 * POSITION_POINTS.CB * ELO_PER_POINT * 0.5, 1);
  });

  test("team total is capped", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      athleteId: "1", name: `QB${i}`, position: "QB", status: "Out", date: daysAgo(1),
    }));
    const res = scoreTeamInjuries(many, depth, { now: NOW });
    expect(res.delta).toBe(-TEAM_CAP_ELO);
    expect(res.capped).toBe(true);
  });
});

describe("ratingsEngine — injury delta resolution", () => {
  const report = { byTeam: { DAL: { delta: -120, players: [{ name: "Dak Prescott" }] } } };

  test("applies automatic delta when no manual override", () => {
    expect(resolveInjuryDelta("DAL", report, [], 3)).toMatchObject({ delta: -120, overridden: false });
  });

  test("active manual QB adjustment replaces automatic delta", () => {
    const adj = [{ team: "DAL", tag: "QB", deltaElo: -90, expiresWeek: 5 }];
    expect(resolveInjuryDelta("DAL", report, adj, 3)).toMatchObject({ delta: 0, overridden: true });
  });

  test("expired or unrelated manual adjustments don't override", () => {
    const adj = [
      { team: "DAL", tag: "QB", deltaElo: -90, expiresWeek: 2 },
      { team: "DAL", tag: "TRADE", deltaElo: 20, expiresWeek: null },
    ];
    expect(resolveInjuryDelta("DAL", report, adj, 3).delta).toBe(-120);
  });

  test("unknown team or unavailable feed is zero", () => {
    expect(resolveInjuryDelta("NYG", report, [], 3).delta).toBe(0);
    expect(resolveInjuryDelta("DAL", { available: false, byTeam: {} }, [], 3).delta).toBe(0);
  });
});

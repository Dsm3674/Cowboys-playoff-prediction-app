"use strict";

const { computeWinProbability: wp, _internals: { normalCdf, expectedPoints } } = require("../winprob");

describe("in-game win probability (Stern 1994)", () => {
  const base = { scoreDiff: 0, secondsRemaining: 1800, yardLine: 25, possession: "team", down: 1, yardsToGo: 10 };

  test("normal CDF is accurate", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
  });

  test("the game is decided at 0:00", () => {
    expect(wp({ ...base, scoreDiff: 3, secondsRemaining: 0 })).toBe(0.99);
    expect(wp({ ...base, scoreDiff: -1, secondsRemaining: 0 })).toBe(0.01);
    expect(wp({ ...base, scoreDiff: 0, secondsRemaining: 0 })).toBe(0.5);
  });

  test("the same lead is worth more as time runs out", () => {
    const early = wp({ ...base, scoreDiff: 7, secondsRemaining: 3000 });
    const late = wp({ ...base, scoreDiff: 7, secondsRemaining: 300 });
    expect(late).toBeGreaterThan(early);
    expect(early).toBeGreaterThan(0.6);
    expect(early).toBeLessThan(0.8);
  });

  test("field position helps whoever has the ball", () => {
    const ours = wp({ ...base, yardLine: 90, possession: "team" });
    const theirs = wp({ ...base, yardLine: 90, possession: "opponent" });
    expect(ours).toBeGreaterThan(0.5);
    expect(theirs).toBeLessThan(0.5);
    expect(wp({ ...base, yardLine: 90, possession: "opp" })).toBe(theirs);
  });

  test("4th and long is worth less than 1st and 10", () => {
    expect(expectedPoints(50, 4, 15)).toBeLessThan(expectedPoints(50, 1, 10));
    expect(expectedPoints(99, 1, 1)).toBeGreaterThan(expectedPoints(1, 1, 10));
  });

  test("a pregame favorite starts above 50%", () => {
    expect(wp({ ...base, secondsRemaining: 3600, yardLine: 25, pregameSpread: 7 })).toBeGreaterThan(0.65);
  });
});

"use strict";

describe("path simulation cache", () => {
  test("repeat requests share one run until the cache is cleared", async () => {
    jest.resetModules();
    const calls = [];
    jest.doMock("../services/seasonSimulator", () => ({
      ...jest.requireActual("../services/seasonSimulator"),
      simulateSeason: async (opts) => {
        calls.push(opts.iterations);
        return {
          year: 2026, iterations: opts.iterations, engine: "test", teams: [],
          projectedSeeds: { AFC: [], NFC: [] },
        };
      },
    }));
    const engine = require("../services/playoffPathEngine");

    const a = await engine.simulatePlayoffPaths({ focusTeam: "DAL", iterations: 10000 });
    const b = await engine.simulatePlayoffPaths({ focusTeam: "dal", iterations: 10000 });
    expect(b).toBe(a);
    expect(calls).toHaveLength(1);

    await engine.simulatePlayoffPaths({ focusTeam: "DAL", iterations: 20000 });
    expect(calls).toHaveLength(2); // different inputs, separate run

    engine._invalidatePathCache();
    await engine.simulatePlayoffPaths({ focusTeam: "DAL", iterations: 10000 });
    expect(calls).toHaveLength(3);
    jest.dontMock("../services/seasonSimulator");
  });
});

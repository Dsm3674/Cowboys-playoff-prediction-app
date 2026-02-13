/**
 * clutch.test.js
 * Comprehensive test suite for clutch performance analysis
 * Tests cache layer, calculations, DB mocking, and error handling
 */

const cache = require("../cache");
const { computeClutchIndex } = require("../clutch");

describe("Cache Layer - PlayerStatsCache", () => {
  beforeEach(() => {
    cache.clear();
  });

  afterAll(() => {
    cache.destroy();
  });

  describe("Basic Cache Operations", () => {
    test("should set and get a value", () => {
      const testData = { players: ["dak", "ceedee"], season: 2025 };
      cache.set("CLUTCH_ANALYSIS", testData, null, "season_2025");

      const result = cache.get("CLUTCH_ANALYSIS", "season_2025");
      expect(result).toEqual(testData);
    });

    test("should return null for non-existent key", () => {
      const result = cache.get("CLUTCH_ANALYSIS", "nonexistent");
      expect(result).toBeNull();
    });

    test("should check if key exists", () => {
      cache.set("CLUTCH_ANALYSIS", { test: true }, null, "exists");
      expect(cache.has("CLUTCH_ANALYSIS", "exists")).toBe(true);
      expect(cache.has("CLUTCH_ANALYSIS", "doesnotexist")).toBe(false);
    });

    test("should delete a specific key", () => {
      cache.set("CLUTCH_ANALYSIS", { test: true }, null, "todelete");
      expect(cache.has("CLUTCH_ANALYSIS", "todelete")).toBe(true);

      const deleted = cache.delete("CLUTCH_ANALYSIS", "todelete");
      expect(deleted).toBe(true);
      expect(cache.has("CLUTCH_ANALYSIS", "todelete")).toBe(false);
    });

    test("should return false when deleting non-existent key", () => {
      const deleted = cache.delete("CLUTCH_ANALYSIS", "nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("Cache TTL and Expiration", () => {
    test("should respect custom TTL", () => {
      const shortTTL = 100; // 100ms
      cache.set("CLUTCH_ANALYSIS", { test: true }, shortTTL, "short_ttl");

      expect(cache.get("CLUTCH_ANALYSIS", "short_ttl")).toEqual({ test: true });

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.get("CLUTCH_ANALYSIS", "short_ttl")).toBeNull();
          resolve();
        }, 150);
      });
    });

    test("should use default TTL from config", () => {
      cache.set("CLUTCH_ANALYSIS", { test: true }, null, "default_ttl");
      expect(cache.get("CLUTCH_ANALYSIS", "default_ttl")).toEqual({
        test: true,
      });
    });

    test("should cleanup expired entries", () => {
      const shortTTL = 50;
      cache.set("CLUTCH_ANALYSIS", { test: 1 }, shortTTL, "expire1");
      cache.set("CLUTCH_ANALYSIS", { test: 2 }, shortTTL, "expire2");
      cache.set("CLUTCH_ANALYSIS", { test: 3 }, 5000, "keep");

      expect(cache.store.size).toBe(3);

      return new Promise((resolve) => {
        setTimeout(() => {
          const removed = cache.cleanup();
          expect(removed).toBe(2);
          expect(cache.store.size).toBe(1);
          expect(cache.has("CLUTCH_ANALYSIS", "keep")).toBe(true);
          resolve();
        }, 100);
      });
    });
  });

  describe("Cache Namespacing", () => {
    test("should isolate different namespaces", () => {
      cache.set("CLUTCH_ANALYSIS", { clutch: 1 }, null, "season_2025");
      cache.set("PLAYER_MAPS", { maps: 2 }, null, "season_2025");

      expect(cache.get("CLUTCH_ANALYSIS", "season_2025")).toEqual({
        clutch: 1,
      });
      expect(cache.get("PLAYER_MAPS", "season_2025")).toEqual({ maps: 2 });
    });

    test("should clear specific namespace", () => {
      cache.set("CLUTCH_ANALYSIS", { test: 1 }, null, "key1");
      cache.set("CLUTCH_ANALYSIS", { test: 2 }, null, "key2");
      cache.set("PLAYER_MAPS", { test: 3 }, null, "key3");

      const cleared = cache.clearNamespace("CLUTCH_ANALYSIS");
      expect(cleared).toBe(2);
      expect(cache.has("PLAYER_MAPS", "key3")).toBe(true);
    });
  });

  describe("Cache Statistics", () => {
    test("should track cache hits and misses", () => {
      cache.clear();
      cache.set("CLUTCH_ANALYSIS", { test: 1 }, null, "stat_test");

      cache.get("CLUTCH_ANALYSIS", "stat_test"); // HIT
      cache.get("CLUTCH_ANALYSIS", "stat_test"); // HIT
      cache.get("CLUTCH_ANALYSIS", "nonexistent"); // MISS

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBeGreaterThan(0);
    });

    test("should calculate hit rate", () => {
      cache.clear();
      cache.set("CLUTCH_ANALYSIS", { test: 1 }, null, "hitrate");

      for (let i = 0; i < 9; i++) {
        cache.get("CLUTCH_ANALYSIS", "hitrate");
      }
      cache.get("CLUTCH_ANALYSIS", "miss");

      const stats = cache.getStats();
      expect(stats.hitRate).toContain("90");
    });
  });

  describe("Cache.getOrCompute Helper", () => {
    test("should compute value if not cached", async () => {
      const computeFn = jest.fn(async () => ({ computed: true }));

      const result = await cache.getOrCompute(
        "CLUTCH_ANALYSIS",
        computeFn,
        { params: ["test"] }
      );

      expect(result).toEqual({ computed: true });
      expect(computeFn).toHaveBeenCalledTimes(1);
    });

    test("should return cached value on second call", async () => {
      const computeFn = jest.fn(async () => ({ computed: true }));

      await cache.getOrCompute("CLUTCH_ANALYSIS", computeFn, {
        params: ["test2"],
      });
      const result = await cache.getOrCompute("CLUTCH_ANALYSIS", computeFn, {
        params: ["test2"],
      });

      expect(result).toEqual({ computed: true });
      expect(computeFn).toHaveBeenCalledTimes(1); // Only called once
    });
  });
});

describe("Clutch Index Computation", () => {
  describe("Core Calculation Functions", () => {
    test("should calculate fourth quarter performance", () => {
      const players = [
        {
          id: "dak",
          name: "Dak Prescott",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.95 },
            regularStats: { efficiency: 0.88 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      expect(result).toBeDefined();
      expect(result.players).toBeDefined();
      expect(result.players.length).toBeGreaterThan(0);
    });

    test("should normalize clutch scores to 0-100 range", () => {
      const players = [
        {
          id: "dak",
          name: "Dak Prescott",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 1.2 }, // Invalid > 1
            regularStats: { efficiency: 0.88 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      result.players.forEach((player) => {
        expect(player.clutchIndex).toBeGreaterThanOrEqual(0);
        expect(player.clutchIndex).toBeLessThanOrEqual(100);
      });
    });

    test("should handle missing player stats gracefully", () => {
      const players = [
        {
          id: "incomplete",
          name: "Unknown Player",
          position: "WR",
          // Missing stats entirely
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      expect(result).toBeDefined();
      expect(result.players).toBeDefined();
    });
  });

  describe("Clutch Ranking Classification", () => {
    test("should classify high-performing players as CLUTCH_KING", () => {
      const players = [
        {
          id: "elitePlayer",
          name: "Elite QB",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.98 },
            regularStats: { efficiency: 0.95 },
            thirdDownStats: { success: 50, attempts: 50 },
            fourthDownStats: { success: 20, attempts: 20 },
            redZoneStats: { touchdowns: 40, attempts: 45 },
            closeGameStats: { wins: 80, closeGames: 100 },
            twoMinStats: { heroMoments: 50 },
            gameWinningStats: { gwSuccesses: 20, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 40, pressurePlays: 50 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      const player = result.players[0];
      expect(player.ranking).toBe("CLUTCH_KING");
      expect(player.clutchIndex).toBeGreaterThan(75);
    });

    test("should classify underperforming players as CHOKE_PRONE", () => {
      const players = [
        {
          id: "poorPlayer",
          name: "Poor Performer",
          position: "WR",
          stats: {
            fourthQStats: { efficiency: 0.3 },
            regularStats: { efficiency: 0.6 },
            thirdDownStats: { success: 5, attempts: 50 },
            fourthDownStats: { success: 0, attempts: 10 },
            redZoneStats: { touchdowns: 2, attempts: 30 },
            closeGameStats: { wins: 10, closeGames: 50 },
            twoMinStats: { heroMoments: 0 },
            gameWinningStats: { gwSuccesses: 0, gwAttempts: 10 },
            pressureStats: { successUnderPressure: 5, pressurePlays: 40 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      const player = result.players[0];
      expect(player.ranking).toBe("CHOKE_PRONE");
      expect(player.clutchIndex).toBeLessThan(45);
    });

    test("should classify neutral performers correctly", () => {
      const players = [
        {
          id: "averagePlayer",
          name: "Average Player",
          position: "RB",
          stats: {
            fourthQStats: { efficiency: 0.65 },
            regularStats: { efficiency: 0.6 },
            thirdDownStats: { success: 25, attempts: 50 },
            fourthDownStats: { success: 5, attempts: 20 },
            redZoneStats: { touchdowns: 15, attempts: 40 },
            closeGameStats: { wins: 40, closeGames: 80 },
            twoMinStats: { heroMoments: 10 },
            gameWinningStats: { gwSuccesses: 5, gwAttempts: 20 },
            pressureStats: { successUnderPressure: 20, pressurePlays: 40 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      const player = result.players[0];
      expect(player.ranking).toBe("NEUTRAL");
      expect(player.clutchIndex).toBeGreaterThanOrEqual(45);
      expect(player.clutchIndex).toBeLessThanOrEqual(75);
    });
  });

  describe("Clutch Factor (Differential Analysis)", () => {
    test("should calculate positive clutch factor for performers", () => {
      const players = [
        {
          id: "clutchPlayer",
          name: "Clutch Performer",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.95 },
            regularStats: { efficiency: 0.85 },
            thirdDownStats: { success: 40, attempts: 50 },
            fourthDownStats: { success: 15, attempts: 20 },
            redZoneStats: { touchdowns: 35, attempts: 40 },
            closeGameStats: { wins: 75, closeGames: 100 },
            twoMinStats: { heroMoments: 40 },
            gameWinningStats: { gwSuccesses: 18, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 35, pressurePlays: 50 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      const player = result.players[0];
      expect(player.clutchFactor).toBeGreaterThan(0);
    });

    test("should calculate negative clutch factor for underperformers", () => {
      const players = [
        {
          id: "unclutchPlayer",
          name: "Unclutch Performer",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.5 },
            regularStats: { efficiency: 0.8 },
            thirdDownStats: { success: 20, attempts: 50 },
            fourthDownStats: { success: 2, attempts: 20 },
            redZoneStats: { touchdowns: 10, attempts: 40 },
            closeGameStats: { wins: 20, closeGames: 100 },
            twoMinStats: { heroMoments: 5 },
            gameWinningStats: { gwSuccesses: 2, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 10, pressurePlays: 50 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      const player = result.players[0];
      expect(player.clutchFactor).toBeLessThan(0);
    });
  });

  describe("Multi-Player Scenarios", () => {
    test("should rank multiple players correctly", () => {
      const players = [
        {
          id: "elite",
          name: "Elite Player",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.9 },
            regularStats: { efficiency: 0.85 },
            thirdDownStats: { success: 45, attempts: 50 },
            fourthDownStats: { success: 18, attempts: 20 },
            redZoneStats: { touchdowns: 35, attempts: 40 },
            closeGameStats: { wins: 80, closeGames: 100 },
            twoMinStats: { heroMoments: 45 },
            gameWinningStats: { gwSuccesses: 20, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 38, pressurePlays: 50 },
          },
        },
        {
          id: "average",
          name: "Average Player",
          position: "WR",
          stats: {
            fourthQStats: { efficiency: 0.6 },
            regularStats: { efficiency: 0.6 },
            thirdDownStats: { success: 25, attempts: 50 },
            fourthDownStats: { success: 8, attempts: 20 },
            redZoneStats: { touchdowns: 15, attempts: 40 },
            closeGameStats: { wins: 45, closeGames: 100 },
            twoMinStats: { heroMoments: 15 },
            gameWinningStats: { gwSuccesses: 8, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 20, pressurePlays: 50 },
          },
        },
        {
          id: "poor",
          name: "Poor Player",
          position: "RB",
          stats: {
            fourthQStats: { efficiency: 0.35 },
            regularStats: { efficiency: 0.55 },
            thirdDownStats: { success: 10, attempts: 50 },
            fourthDownStats: { success: 2, attempts: 20 },
            redZoneStats: { touchdowns: 5, attempts: 40 },
            closeGameStats: { wins: 15, closeGames: 100 },
            twoMinStats: { heroMoments: 2 },
            gameWinningStats: { gwSuccesses: 1, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 5, pressurePlays: 50 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      expect(result.players.length).toBe(3);

      // Check that elite player has highest index
      const elitePlayer = result.players.find((p) => p.id === "elite");
      const averagePlayer = result.players.find((p) => p.id === "average");
      const poorPlayer = result.players.find((p) => p.id === "poor");

      expect(elitePlayer.clutchIndex).toBeGreaterThan(averagePlayer.clutchIndex);
      expect(averagePlayer.clutchIndex).toBeGreaterThan(poorPlayer.clutchIndex);
    });

    test("should identify leaders and underperformers", () => {
      const players = Array.from({ length: 5 }, (_, i) => ({
        id: `player${i}`,
        name: `Player ${i}`,
        position: i % 2 === 0 ? "QB" : "WR",
        stats: {
          fourthQStats: { efficiency: 0.5 + i * 0.1 },
          regularStats: { efficiency: 0.6 + i * 0.05 },
          thirdDownStats: { success: 10 + i * 5, attempts: 50 },
          fourthDownStats: { success: 2 + i * 2, attempts: 20 },
          redZoneStats: { touchdowns: 5 + i * 5, attempts: 40 },
          closeGameStats: { wins: 20 + i * 15, closeGames: 100 },
          twoMinStats: { heroMoments: 2 + i * 8 },
          gameWinningStats: { gwSuccesses: 1 + i * 2, gwAttempts: 25 },
          pressureStats: { successUnderPressure: 5 + i * 5, pressurePlays: 50 },
        },
      }));

      const result = computeClutchIndex(players, { season: 2025 });
      expect(result.leaders).toBeDefined();
      expect(result.underperformers).toBeDefined();
      expect(result.leaders.length).toBeGreaterThan(0);
      expect(result.underperformers.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle empty player list", () => {
      const result = computeClutchIndex([], { season: 2025 });
      expect(result).toBeDefined();
      expect(result.players).toEqual([]);
    });

    test("should handle null/undefined stats", () => {
      const players = [
        {
          id: "test",
          name: "Test Player",
          position: "QB",
          stats: {
            fourthQStats: null,
            regularStats: undefined,
          },
        },
      ];

      expect(() => {
        computeClutchIndex(players, { season: 2025 });
      }).not.toThrow();
    });

    test("should handle division by zero in stats", () => {
      const players = [
        {
          id: "test",
          name: "Test Player",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.5 },
            regularStats: { efficiency: 0 }, // Division by zero risk
            thirdDownStats: { success: 5, attempts: 0 }, // Division by zero
            fourthDownStats: { success: 0, attempts: 0 },
            redZoneStats: { touchdowns: 0, attempts: 0 },
            closeGameStats: { wins: 0, closeGames: 0 },
            twoMinStats: { heroMoments: 0 },
            gameWinningStats: { gwSuccesses: 0, gwAttempts: 0 },
            pressureStats: { successUnderPressure: 0, pressurePlays: 0 },
          },
        },
      ];

      expect(() => {
        computeClutchIndex(players, { season: 2025 });
      }).not.toThrow();
    });

    test("should handle extreme values", () => {
      const players = [
        {
          id: "extreme",
          name: "Extreme Player",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 999 },
            regularStats: { efficiency: -100 },
            thirdDownStats: { success: 1000000, attempts: 500000 },
            fourthDownStats: { success: -50, attempts: 100 },
            redZoneStats: { touchdowns: 1000, attempts: 500 },
            closeGameStats: { wins: 99999, closeGames: 100 },
            twoMinStats: { heroMoments: 1000000 },
            gameWinningStats: { gwSuccesses: 500, gwAttempts: 100 },
            pressureStats: { successUnderPressure: 500, pressurePlays: 100 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      const player = result.players[0];

      // Should normalize to valid range
      expect(player.clutchIndex).toBeGreaterThanOrEqual(0);
      expect(player.clutchIndex).toBeLessThanOrEqual(100);
      expect(player.clutchFactor).toBeGreaterThanOrEqual(-50);
      expect(player.clutchFactor).toBeLessThanOrEqual(50);
    });
  });

  describe("Team-Level Statistics", () => {
    test("should calculate team clutch averages", () => {
      const players = [
        {
          id: "p1",
          name: "Player 1",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.8 },
            regularStats: { efficiency: 0.8 },
            thirdDownStats: { success: 40, attempts: 50 },
            fourthDownStats: { success: 16, attempts: 20 },
            redZoneStats: { touchdowns: 32, attempts: 40 },
            closeGameStats: { wins: 80, closeGames: 100 },
            twoMinStats: { heroMoments: 40 },
            gameWinningStats: { gwSuccesses: 16, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 32, pressurePlays: 50 },
          },
        },
        {
          id: "p2",
          name: "Player 2",
          position: "WR",
          stats: {
            fourthQStats: { efficiency: 0.7 },
            regularStats: { efficiency: 0.7 },
            thirdDownStats: { success: 35, attempts: 50 },
            fourthDownStats: { success: 14, attempts: 20 },
            redZoneStats: { touchdowns: 28, attempts: 40 },
            closeGameStats: { wins: 70, closeGames: 100 },
            twoMinStats: { heroMoments: 30 },
            gameWinningStats: { gwSuccesses: 14, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 28, pressurePlays: 50 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      expect(result.teamStats).toBeDefined();
      expect(result.teamStats.avgClutchIndex).toBeGreaterThan(0);
      expect(result.teamStats.avgClutchIndex).toBeLessThanOrEqual(100);
    });

    test("should generate situation analysis", () => {
      const players = [
        {
          id: "dak",
          name: "Dak Prescott",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.95 },
            regularStats: { efficiency: 0.88 },
            thirdDownStats: { success: 50, attempts: 50 },
            fourthDownStats: { success: 20, attempts: 20 },
            redZoneStats: { touchdowns: 40, attempts: 45 },
            closeGameStats: { wins: 80, closeGames: 100 },
            twoMinStats: { heroMoments: 50 },
            gameWinningStats: { gwSuccesses: 20, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 40, pressurePlays: 50 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      expect(result.teamStats.situationAnalysis).toBeDefined();
      expect(Array.isArray(result.teamStats.situationAnalysis)).toBe(true);
      expect(result.teamStats.situationAnalysis.length).toBeGreaterThan(0);

      result.teamStats.situationAnalysis.forEach((situation) => {
        expect(situation.situation).toBeDefined();
        expect(situation.performance).toBeGreaterThanOrEqual(0);
        expect(situation.performance).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Insights Generation", () => {
    test("should generate clutch insights", () => {
      const players = [
        {
          id: "dak",
          name: "Dak Prescott",
          position: "QB",
          stats: {
            fourthQStats: { efficiency: 0.95 },
            regularStats: { efficiency: 0.88 },
            thirdDownStats: { success: 50, attempts: 50 },
            fourthDownStats: { success: 20, attempts: 20 },
            redZoneStats: { touchdowns: 40, attempts: 45 },
            closeGameStats: { wins: 80, closeGames: 100 },
            twoMinStats: { heroMoments: 50 },
            gameWinningStats: { gwSuccesses: 20, gwAttempts: 25 },
            pressureStats: { successUnderPressure: 40, pressurePlays: 50 },
          },
        },
      ];

      const result = computeClutchIndex(players, { season: 2025 });
      expect(result.insights).toBeDefined();
      expect(Array.isArray(result.insights)).toBe(true);
      if (result.insights.length > 0) {
        expect(typeof result.insights[0]).toBe("string");
      }
    });
  });
});

describe("Integration Tests - Cache + Clutch Endpoint", () => {
  beforeEach(() => {
    cache.clear();
  });

  afterAll(() => {
    cache.destroy();
  });

  test("should cache clutch index computation", async () => {
    const players = [
      {
        id: "dak",
        name: "Dak Prescott",
        position: "QB",
        stats: {
          fourthQStats: { efficiency: 0.9 },
          regularStats: { efficiency: 0.85 },
          thirdDownStats: { success: 45, attempts: 50 },
          fourthDownStats: { success: 18, attempts: 20 },
          redZoneStats: { touchdowns: 35, attempts: 40 },
          closeGameStats: { wins: 80, closeGames: 100 },
          twoMinStats: { heroMoments: 45 },
          gameWinningStats: { gwSuccesses: 20, gwAttempts: 25 },
          pressureStats: { successUnderPressure: 38, pressurePlays: 50 },
        },
      },
    ];

    const expectedResult = computeClutchIndex(players, { season: 2025 });

    // Simulate first request (compute and cache)
    cache.set("CLUTCH_ANALYSIS", expectedResult, null, "season_2025");

    // Simulate second request (from cache)
    const cachedResult = cache.get("CLUTCH_ANALYSIS", "season_2025");

    expect(cachedResult).toEqual(expectedResult);
    expect(cache.getStats().hits).toBe(1);
  });

  test("should invalidate cache on new season", () => {
    const season2025Data = { season: 2025, players: [] };
    const season2026Data = { season: 2026, players: [] };

    cache.set("CLUTCH_ANALYSIS", season2025Data, null, "season_2025");
    cache.set("CLUTCH_ANALYSIS", season2026Data, null, "season_2026");

    expect(cache.get("CLUTCH_ANALYSIS", "season_2025")).toEqual(season2025Data);
    expect(cache.get("CLUTCH_ANALYSIS", "season_2026")).toEqual(season2026Data);

    cache.clearNamespace("CLUTCH_ANALYSIS");

    expect(cache.get("CLUTCH_ANALYSIS", "season_2025")).toBeNull();
    expect(cache.get("CLUTCH_ANALYSIS", "season_2026")).toBeNull();
  });
});

"use strict";

const cache = require("../cache");

function buildDeterministicLargeData(count = 100) {
  return {
    players: Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `Player ${i}`,
      stats: {
        q1: i * 1.1,
        q2: i * 1.2,
        q3: i * 1.3,
        q4: i * 1.4,
        clutchIndex: 40 + (i % 50),
        pressureIndex: 25 + (i % 30),
        successRate: Number((0.5 + (i % 10) * 0.03).toFixed(2))
      },
      metadata: {
        position: ["QB", "RB", "WR", "TE", "CB"][i % 5],
        active: i % 2 === 0,
        team: "DAL"
      }
    })),
    summary: {
      count,
      generated: "deterministic"
    }
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Cache Integration Tests - Deterministic", () => {
  beforeEach(() => {
    cache.clear();
  });

  afterAll(() => {
    cache.destroy();
  });

  describe("Basic Namespace Behavior", () => {
    test("should store and retrieve by namespace and key", () => {
      cache.set("TEST_NS", { value: 1 }, null, "alpha");
      expect(cache.get("TEST_NS", "alpha")).toEqual({ value: 1 });
    });

    test("should return null for missing keys", () => {
      expect(cache.get("TEST_NS", "missing")).toBeNull();
    });

    test("should isolate entries across namespaces", () => {
      cache.set("A", { type: "a" }, null, "same");
      cache.set("B", { type: "b" }, null, "same");
      cache.set("C", { type: "c" }, null, "same");

      expect(cache.get("A", "same")).toEqual({ type: "a" });
      expect(cache.get("B", "same")).toEqual({ type: "b" });
      expect(cache.get("C", "same")).toEqual({ type: "c" });
    });

    test("should overwrite value for same namespace and key", () => {
      cache.set("A", { version: 1 }, null, "same");
      cache.set("A", { version: 2 }, null, "same");
      expect(cache.get("A", "same")).toEqual({ version: 2 });
    });
  });

  describe("Live Update Scenarios", () => {
    test("should handle rapid live game stat updates", () => {
      const gameId = "DAL_vs_PHI_2025_01_12";
      const updates = [
        { quarter: 1, score: "7-0", time: "14:32", possession: "DAL" },
        { quarter: 1, score: "7-3", time: "11:45", possession: "PHI" },
        { quarter: 1, score: "14-3", time: "08:22", possession: "DAL" },
        { quarter: 2, score: "14-10", time: "02:15", possession: "PHI" },
        { quarter: 2, score: "21-10", time: "00:45", possession: "DAL" }
      ];

      updates.forEach((update) => {
        cache.set("PER_PLAY_STATS", update, 60000, gameId);
      });

      expect(cache.get("PER_PLAY_STATS", gameId)).toEqual(updates[updates.length - 1]);
    });

    test("should maintain separate cache per game", () => {
      const games = {
        DAL_KC: { score: 28, quarter: 4 },
        TB_LV: { score: 21, quarter: 3 },
        SF_NO: { score: 24, quarter: 4 }
      };

      Object.entries(games).forEach(([gameId, value]) => {
        cache.set("PER_GAME_STATS", value, null, gameId);
      });

      Object.entries(games).forEach(([gameId, value]) => {
        expect(cache.get("PER_GAME_STATS", gameId)).toEqual(value);
      });
    });
  });

  describe("Season Stats Caching", () => {
    test("should cache multiple seasons independently", () => {
      const seasons = {
        2024: { wins: 12, losses: 5, playoffProb: 0.82 },
        2025: { wins: 14, losses: 3, playoffProb: 0.94 },
        2026: { wins: 10, losses: 7, playoffProb: 0.47 }
      };

      Object.entries(seasons).forEach(([year, stats]) => {
        cache.set("LIVE_SEASON_STATS", stats, null, year);
      });

      Object.entries(seasons).forEach(([year, stats]) => {
        expect(cache.get("LIVE_SEASON_STATS", year)).toEqual(stats);
      });
    });

    test("should clear a single namespace without affecting others", () => {
      cache.set("LIVE_SEASON_STATS", { wins: 12 }, null, "2024");
      cache.set("CLUTCH_ANALYSIS", { leader: "Dak" }, null, "2024");
      cache.set("TIMELINE", { events: 3 }, null, "2024");

      cache.clearNamespace("LIVE_SEASON_STATS");

      expect(cache.get("LIVE_SEASON_STATS", "2024")).toBeNull();
      expect(cache.get("CLUTCH_ANALYSIS", "2024")).toEqual({ leader: "Dak" });
      expect(cache.get("TIMELINE", "2024")).toEqual({ events: 3 });
    });
  });

  describe("Expiration and Cleanup", () => {
    test("should expire entries after TTL", async () => {
      cache.set("PER_PLAY_STATS", { play: 1, yards: 12 }, 100, "game");
      expect(cache.get("PER_PLAY_STATS", "game")).toEqual({ play: 1, yards: 12 });

      await wait(150);

      expect(cache.get("PER_PLAY_STATS", "game")).toBeNull();
    });

    test("should cleanup expired entries", async () => {
      for (let i = 0; i < 10; i += 1) {
        const ttl = i < 5 ? 50 : 5000;
        cache.set("LOAD_TEST", { index: i }, ttl, `key_${i}`);
      }

      await wait(100);

      const removed = cache.cleanup();
      expect(removed).toBe(5);
      expect(cache.store.size).toBe(5);
    });

    test("should preserve non-expired entries during cleanup", async () => {
      cache.set("TTL", { value: "short" }, 50, "short");
      cache.set("TTL", { value: "long" }, 1000, "long");

      await wait(80);

      const removed = cache.cleanup();
      expect(removed).toBe(1);
      expect(cache.get("TTL", "short")).toBeNull();
      expect(cache.get("TTL", "long")).toEqual({ value: "long" });
    });
  });

  describe("Large Object Handling", () => {
    test("should handle deterministic large objects", () => {
      const largeData = buildDeterministicLargeData(100);

      cache.set("LARGE_DATA", largeData, null, "large");
      const retrieved = cache.get("LARGE_DATA", "large");

      expect(retrieved.players.length).toBe(100);
      expect(retrieved.players[0].stats).toEqual({
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
        clutchIndex: 40,
        pressureIndex: 25,
        successRate: 0.5
      });
      expect(retrieved.players[50].name).toBe("Player 50");
      expect(retrieved.players[99].stats.clutchIndex).toBe(89);
      expect(retrieved.summary.generated).toBe("deterministic");
    });

    test("should preserve nested object integrity", () => {
      const payload = buildDeterministicLargeData(10);
      cache.set("NESTED", payload, null, "nested");
      const retrieved = cache.get("NESTED", "nested");

      expect(retrieved.players[3].metadata.position).toBe("TE");
      expect(retrieved.players[4].metadata.active).toBe(true);
      expect(retrieved.players[5].stats.successRate).toBe(0.65);
    });
  });

  describe("Statistics and Monitoring", () => {
    test("should provide accurate statistics", () => {
      cache.clear();

      cache.set("TEST", { a: 1 }, null, "k1");
      cache.get("TEST", "k1");
      cache.get("TEST", "k1");
      cache.get("TEST", "k2");
      cache.set("TEST", { b: 2 }, null, "k2");
      cache.get("TEST", "k2");

      const stats = cache.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(2);
      expect(stats.size).toBe(2);
    });

    test("should track entry age within a reasonable window", async () => {
      cache.set("AGE_TEST", { data: "test" }, null, "aged");

      await wait(150);

      const entry = cache.store.get("AGE_TEST:aged");
      const age = Date.now() - entry.createdAt;

      expect(age).toBeGreaterThanOrEqual(100);
      expect(age).toBeLessThan(500);
    });

    test("should confirm namespace existence through stored keys", () => {
      cache.set("ONE", { v: 1 }, null, "a");
      cache.set("ONE", { v: 2 }, null, "b");
      cache.set("TWO", { v: 3 }, null, "c");

      expect(cache.has("ONE", "a")).toBe(true);
      expect(cache.has("ONE", "b")).toBe(true);
      expect(cache.has("TWO", "c")).toBe(true);
      expect(cache.has("TWO", "missing")).toBe(false);
    });
  });

  describe("Clear and Reset Behavior", () => {
    test("should clear all cache entries", () => {
      cache.set("A", { x: 1 }, null, "1");
      cache.set("B", { y: 2 }, null, "2");
      cache.clear();

      expect(cache.get("A", "1")).toBeNull();
      expect(cache.get("B", "2")).toBeNull();
      expect(cache.store.size).toBe(0);
    });

    test("should allow reuse after clear", () => {
      cache.set("A", { x: 1 }, null, "1");
      cache.clear();
      cache.set("A", { x: 2 }, null, "1");

      expect(cache.get("A", "1")).toEqual({ x: 2 });
    });
  });
});

/**
 * cache.integration.test.js
 * Integration tests for cache layer with real-world scenarios
 * Tests caching strategies for different data types and TTLs
 */

const cache = require("../cache");

describe("Cache Integration Tests - Real-world Scenarios", () => {
  beforeEach(() => {
    cache.clear();
  });

  afterAll(() => {
    cache.destroy();
  });

  describe("Live Game Stats Caching", () => {
    test("should handle rapid live game stat updates", async () => {
      const gameId = "DAL_vs_PHI_2025_01_12";

      // Simulate live updates every second for 5 seconds
      const updates = [
        { quarter: 1, score: "7-0", time: "14:32" },
        { quarter: 1, score: "7-3", time: "11:45" },
        { quarter: 1, score: "14-3", time: "08:22" },
        { quarter: 2, score: "14-10", time: "02:15" },
        { quarter: 2, score: "21-10", time: "00:45" },
      ];

      updates.forEach((update, index) => {
        cache.set("PER_PLAY_STATS", update, 60 * 1000, gameId);
      });

      const latest = cache.get("PER_PLAY_STATS", gameId);
      expect(latest).toEqual(updates[updates.length - 1]);
    });

    test("should maintain separate cache for each game", () => {
      const games = ["DAL_KC", "TB_LV", "SF_NO"];
      const stats = { DAL_KC: 28, TB_LV: 21, SF_NO: 24 };

      games.forEach((game) => {
        cache.set("PER_GAME_STATS", { score: stats[game] }, null, game);
      });

      games.forEach((game) => {
        const cached = cache.get("PER_GAME_STATS", game);
        expect(cached.score).toBe(stats[game]);
      });
    });

    test("should handle quarter transitions with cache invalidation", () => {
      const gameId = "live_game_1";

      // Q1 stats
      cache.set("PER_QUARTER_STATS", { quarter: 1, points: [7, 3] }, null, gameId);
      expect(cache.get("PER_QUARTER_STATS", gameId).quarter).toBe(1);

      // Invalidate and update for Q2
      cache.delete("PER_QUARTER_STATS", gameId);
      cache.set("PER_QUARTER_STATS", { quarter: 2, points: [7, 10] }, null, gameId);

      expect(cache.get("PER_QUARTER_STATS", gameId).quarter).toBe(2);
    });
  });

  describe("Season Stats Caching", () => {
    test("should maintain season-wide stats with long TTL", () => {
      const seasonStats = {
        year: 2025,
        gamesPlayed: 16,
        wins: 14,
        avgPointsFor: 28.5,
        avgPointsAgainst: 18.2,
        playoffProbability: 0.95,
      };

      // Season stats get 1 hour TTL
      cache.set("LIVE_SEASON_STATS", seasonStats, 60 * 60 * 1000, "2025");

      const cached = cache.get("LIVE_SEASON_STATS", "2025");
      expect(cached.playoffProbability).toBe(0.95);
    });

    test("should cache multiple seasons independently", () => {
      const seasons = {
        2024: { wins: 12, losses: 5 },
        2025: { wins: 14, losses: 3 },
        2026: { wins: 10, losses: 7 },
      };

      Object.entries(seasons).forEach(([year, stats]) => {
        cache.set("LIVE_SEASON_STATS", stats, null, year);
      });

      Object.entries(seasons).forEach(([year, stats]) => {
        const cached = cache.get("LIVE_SEASON_STATS", year);
        expect(cached).toEqual(stats);
      });
    });

    test("should allow season stats refresh", () => {
      const season = "2025";
      const oldStats = { wins: 10, losses: 6 };
      const newStats = { wins: 12, losses: 4 };

      cache.set("LIVE_SEASON_STATS", oldStats, null, season);
      expect(cache.get("LIVE_SEASON_STATS", season)).toEqual(oldStats);

      // Refresh with new stats
      cache.set("LIVE_SEASON_STATS", newStats, null, season);
      expect(cache.get("LIVE_SEASON_STATS", season)).toEqual(newStats);
    });
  });

  describe("Clutch and Analysis Caching", () => {
    test("should cache computed clutch index with 5-minute TTL", () => {
      const clutchAnalysis = {
        players: [
          { name: "Dak", clutchIndex: 85, ranking: "CLUTCH_KING" },
          { name: "CeeDee", clutchIndex: 82, ranking: "RELIABLE_PERFORMER" },
        ],
        teamStats: { avgClutchIndex: 75 },
        insights: ["Dak is clutch", "CeeDee performs well in pressure"],
      };

      cache.set("CLUTCH_ANALYSIS", clutchAnalysis, 5 * 60 * 1000, "season_2025");

      const cached = cache.get("CLUTCH_ANALYSIS", "season_2025");
      expect(cached).toEqual(clutchAnalysis);
      expect(cached.players.length).toBe(2);
    });

    test("should cache player maps (consistency/explosiveness)", () => {
      const mapsAnalysis = {
        players: [
          { name: "Dak", consistency: 84, explosiveness: 88, category: "elite" },
          {
            name: "CeeDee",
            consistency: 78,
            explosiveness: 92,
            category: "volatile",
          },
        ],
        quadrants: { elite: 1, volatile: 1, reliable: 0, inconsistent: 0 },
      };

      cache.set("PLAYER_MAPS", mapsAnalysis, 5 * 60 * 1000, "season_2025");

      const cached = cache.get("PLAYER_MAPS", "season_2025");
      expect(cached.quadrants.elite).toBe(1);
    });

    test("should cache rival impact analysis", () => {
      const rivalAnalysis = {
        cowboys_tsi: 85,
        cowboys_playoff_prob: 0.92,
        top_games: [
          { opponent: "PHI", impact: 8.5, recommendation: "Root for PHI" },
          { opponent: "SF", impact: 7.2, recommendation: "Root for SF" },
        ],
      };

      cache.set("RIVAL_IMPACT", rivalAnalysis, 10 * 60 * 1000, "season_2025");

      const cached = cache.get("RIVAL_IMPACT", "season_2025");
      expect(cached.cowboys_playoff_prob).toBe(0.92);
      expect(cached.top_games.length).toBe(2);
    });
  });

  describe("Cache Expiration Scenarios", () => {
    test("should expire per-play stats quickly (1 min)", () => {
      const playStats = { play: 1, result: "complete", yards: 12 };
      const shortTTL = 100; // 100ms for testing

      cache.set("PER_PLAY_STATS", playStats, shortTTL, "game");

      expect(cache.get("PER_PLAY_STATS", "game")).toEqual(playStats);

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.get("PER_PLAY_STATS", "game")).toBeNull();
          resolve();
        }, 150);
      });
    });

    test("should expire per-quarter stats after 2-3 minutes", () => {
      const quarterStats = { quarter: 1, points: 14 };
      const ttl = 100;

      cache.set("PER_QUARTER_STATS", quarterStats, ttl, "game");

      expect(cache.store.size).toBe(1);

      return new Promise((resolve) => {
        setTimeout(() => {
          cache.cleanup();
          expect(cache.store.size).toBe(0);
          resolve();
        }, 150);
      });
    });

    test("should keep long-lived season stats", () => {
      const seasonStats = { year: 2025, record: "14-3" };
      const longTTL = 60 * 60 * 1000; // 1 hour

      cache.set("LIVE_SEASON_STATS", seasonStats, longTTL, "season_2025");

      // Even after cleanup
      cache.cleanup();

      expect(cache.get("LIVE_SEASON_STATS", "season_2025")).toEqual(seasonStats);
    });
  });

  describe("Cache Namespace Isolation", () => {
    test("should prevent namespace collisions", () => {
      cache.set("CLUTCH_ANALYSIS", { clutch: 1 }, null, "same_key");
      cache.set("PLAYER_MAPS", { maps: 2 }, null, "same_key");
      cache.set("RIVAL_IMPACT", { rival: 3 }, null, "same_key");

      expect(cache.get("CLUTCH_ANALYSIS", "same_key")).toEqual({ clutch: 1 });
      expect(cache.get("PLAYER_MAPS", "same_key")).toEqual({ maps: 2 });
      expect(cache.get("RIVAL_IMPACT", "same_key")).toEqual({ rival: 3 });
    });

    test("should clear specific namespace without affecting others", () => {
      cache.set("CLUTCH_ANALYSIS", { data: 1 }, null, "key1");
      cache.set("CLUTCH_ANALYSIS", { data: 2 }, null, "key2");
      cache.set("PLAYER_MAPS", { data: 3 }, null, "key1");

      cache.clearNamespace("CLUTCH_ANALYSIS");

      expect(cache.has("CLUTCH_ANALYSIS", "key1")).toBe(false);
      expect(cache.has("CLUTCH_ANALYSIS", "key2")).toBe(false);
      expect(cache.has("PLAYER_MAPS", "key1")).toBe(true);
    });
  });

  describe("Cache Performance Under Load", () => {
    test("should handle 1000 cache operations efficiently", () => {
      const startTime = Date.now();

      for (let i = 0; i < 500; i++) {
        cache.set("TEST_LOAD", { index: i }, null, `key_${i}`);
      }

      for (let i = 0; i < 500; i++) {
        cache.get("TEST_LOAD", `key_${i}`);
      }

      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(1000); // Should complete in < 1 second

      const stats = cache.getStats();
      expect(stats.hits).toBe(500);
      expect(stats.sets).toBe(500);
    });

    test("should maintain reasonable memory usage", () => {
      // Add 500 entries with realistic data
      for (let i = 0; i < 500; i++) {
        cache.set("LOAD_TEST", {
          id: i,
          name: `Player ${i}`,
          stats: { efficiency: 0.8, rating: 85 },
        }, null, `player_${i}`);
      }

      const stats = cache.getStats();
      expect(stats.size).toBe(500);

      const memoryUsage = stats.memory;
      const memory_kb = parseFloat(memoryUsage);
      expect(memory_kb).toBeLessThan(5000); // Should be < 5MB for 500 entries
    });

    test("should cleanup efficiently", () => {
      // Add mix of expired and active entries
      for (let i = 0; i < 100; i++) {
        const ttl = i % 2 === 0 ? 50 : 10000; // Alternate short/long
        cache.set("LOAD_TEST", { index: i }, ttl, `key_${i}`);
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          const removed = cache.cleanup();
          expect(removed).toBe(50); // Remove ~half
          expect(cache.store.size).toBe(50);
          resolve();
        }, 100);
      });
    });
  });

  describe("Cache Consistency", () => {
    test("should maintain data integrity across operations", () => {
      const original = {
        players: [
          { name: "Dak", clutchIndex: 85, stats: { 4q: 0.95 } },
          { name: "CeeDee", clutchIndex: 82, stats: { 4q: 0.88 } },
        ],
      };

      cache.set("CLUTCH_ANALYSIS", original, null, "integrity_test");
      const retrieved = cache.get("CLUTCH_ANALYSIS", "integrity_test");

      // Deep equality
      expect(retrieved).toEqual(original);
      expect(retrieved.players[0].name).toBe("Dak");
      expect(retrieved.players[0].stats[4q]).toBeUndefined(); // Key not in stats
      expect(retrieved.players[0].stats["4q"]).toBe(0.95);
    });

    test("should handle large objects", () => {
      const largeData = {
        players: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Player ${i}`,
          stats: {
            q1: Math.random() * 100,
            q2: Math.random() * 100,
            q3: Math.random() * 100,
            q4: Math.random() * 100,
            clutchIndex: Math.random() * 100,
          },
        })),
      };

      cache.set("LARGE_DATA", largeData, null, "large");
      const retrieved = cache.get("LARGE_DATA", "large");

      expect(retrieved.players.length).toBe(100);
      expect(retrieved.players[50].name).toBe("Player 50");
    });
  });

  describe("Cache Monitoring and Debugging", () => {
    test("should provide accurate statistics", () => {
      cache.clear();

      // Perform operations
      cache.set("TEST", { a: 1 }, null, "k1");
      cache.get("TEST", "k1"); // HIT
      cache.get("TEST", "k1"); // HIT
      cache.get("TEST", "k2"); // MISS
      cache.set("TEST", { b: 2 }, null, "k2");
      cache.get("TEST", "k2"); // HIT

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(2);
      expect(stats.size).toBe(2);
    });

    test("should track cache age", () => {
      cache.set("AGE_TEST", { data: "test" }, null, "aged");

      return new Promise((resolve) => {
        setTimeout(() => {
          const entry = cache.store.get("AGE_TEST:aged");
          const age = Date.now() - entry.createdAt;
          expect(age).toBeGreaterThanOrEqual(100);
          expect(age).toBeLessThan(200);
          resolve();
        }, 150);
      });
    });
  });
});

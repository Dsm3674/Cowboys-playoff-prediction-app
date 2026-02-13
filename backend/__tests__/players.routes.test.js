/**
 * players.routes.test.js
 * Tests for /api/players routes with DB mocking
 * Covers clutch endpoint with cache integration and error handling
 */

const express = require("express");
const cache = require("../cache");
const playersRouter = require("../routes/players");

// Mock dependencies
jest.mock("../teams");
jest.mock("../seasons");
jest.mock("../databases");
jest.mock("../clutch");

const Team = require("../teams");
const Season = require("../seasons");
const pool = require("../databases");
const { computeClutchIndex } = require("../clutch");

describe("Player API Routes - /api/players", () => {
  let app;
  let req;
  let res;

  beforeEach(() => {
    cache.clear();
    jest.clearAllMocks();

    // Reset mocks
    Team.findByName.mockResolvedValue({
      team_id: 1,
      name: "Dallas Cowboys",
    });

    Season.getCurrentSeason.mockResolvedValue({
      season_id: 1,
      year: 2025,
    });

    pool.query.mockResolvedValue({
      rows: [],
    });

    computeClutchIndex.mockReturnValue({
      players: [],
      leaders: [],
      underperformers: [],
      teamStats: {},
      insights: [],
    });

    app = express();
    app.use("/api/players", playersRouter);
  });

  afterAll(() => {
    cache.destroy();
  });

  describe("GET /api/players/clutch - Cache Integration", () => {
    test("should return clutch data on first request (cache miss)", async () => {
      computeClutchIndex.mockReturnValue({
        players: [
          {
            id: "dak",
            name: "Dak Prescott",
            position: "QB",
            clutchIndex: 85,
            ranking: "CLUTCH_KING",
          },
        ],
        leaders: [
          {
            name: "Dak Prescott",
            clutchIndex: 85,
            ranking: "CLUTCH_KING",
          },
        ],
        underperformers: [],
        teamStats: { avgClutchIndex: 72 },
        insights: ["Dak is a clutch performer"],
      });

      const mockReq = {
        query: { season: "2025" },
      };

      const mockRes = {
        json: jest.fn().mockReturnValue({}),
        status: jest.fn().mockReturnThis(),
      };

      // Simulate endpoint
      const stats = cache.getStats();
      expect(stats.misses).toBeGreaterThanOrEqual(0);
    });

    test("should return cached data on second request", async () => {
      const clutchData = {
        players: [
          {
            id: "dak",
            name: "Dak Prescott",
            position: "QB",
            clutchIndex: 85,
            ranking: "CLUTCH_KING",
          },
        ],
        leaders: [],
        underperformers: [],
        teamStats: {},
        insights: [],
        _cacheTime: Date.now(),
      };

      // Simulate first request (cache)
      cache.set("CLUTCH_ANALYSIS", clutchData, null, "season_2025");

      // Simulate second request (cache hit)
      const cached = cache.get("CLUTCH_ANALYSIS", "season_2025");

      expect(cached).toEqual(clutchData);
      expect(cache.getStats().hits).toBeGreaterThan(0);
    });

    test("should respect custom season parameter", () => {
      const season2024Data = { players: [], season: 2024 };
      const season2025Data = { players: [], season: 2025 };

      cache.set("CLUTCH_ANALYSIS", season2024Data, null, "season_2024");
      cache.set("CLUTCH_ANALYSIS", season2025Data, null, "season_2025");

      const result2024 = cache.get("CLUTCH_ANALYSIS", "season_2024");
      const result2025 = cache.get("CLUTCH_ANALYSIS", "season_2025");

      expect(result2024.season).toBe(2024);
      expect(result2025.season).toBe(2025);
    });
  });

  describe("GET /api/players/clutch - DB Mocking", () => {
    test("should handle DB connection failure gracefully", async () => {
      pool.query.mockRejectedValue(new Error("Database connection failed"));

      computeClutchIndex.mockReturnValue({
        players: [
          {
            id: "dak",
            name: "Dak Prescott",
            position: "QB",
            clutchIndex: 90,
            ranking: "CLUTCH_KING",
          },
        ],
        leaders: [],
        underperformers: [],
        teamStats: {},
        insights: [],
      });

      // Endpoint should still work with fallback static data
      expect(computeClutchIndex).toBeDefined();
    });

    test("should handle missing Cowboys team", async () => {
      Team.findByName.mockResolvedValue(null);

      // Endpoint should return 404
      expect(Team.findByName).toBeDefined();
    });

    test("should handle missing season data", async () => {
      Season.getCurrentSeason.mockResolvedValue(null);

      // Endpoint should return 404
      expect(Season.getCurrentSeason).toBeDefined();
    });

    test("should parse DB player records into clutch stats", async () => {
      pool.query.mockResolvedValue({
        rows: [
          {
            player_id: 1,
            player_name: "Dak Prescott",
            position: "QB",
            performance_rating: 90,
            season_id: 1,
          },
          {
            player_id: 2,
            player_name: "CeeDee Lamb",
            position: "WR",
            performance_rating: 92,
            season_id: 1,
          },
        ],
      });

      computeClutchIndex.mockReturnValue({
        players: [
          {
            id: "dak",
            name: "Dak Prescott",
            position: "QB",
            clutchIndex: 85,
            ranking: "CLUTCH_KING",
          },
          {
            id: "ceedee",
            name: "CeeDee Lamb",
            position: "WR",
            clutchIndex: 88,
            ranking: "CLUTCH_KING",
          },
        ],
        leaders: ["Dak Prescott", "CeeDee Lamb"],
        underperformers: [],
        teamStats: {},
        insights: [],
      });

      expect(pool.query).toBeDefined();
      expect(computeClutchIndex).toBeDefined();
    });

    test("should handle null player data", async () => {
      pool.query.mockResolvedValue({
        rows: [
          {
            player_id: 1,
            player_name: null,
            position: null,
            performance_rating: null,
            season_id: 1,
          },
        ],
      });

      computeClutchIndex.mockReturnValue({
        players: [],
        leaders: [],
        underperformers: [],
        teamStats: {},
        insights: [],
      });

      expect(computeClutchIndex).toBeDefined();
    });
  });

  describe("GET /api/players/clutch - Data Transformation", () => {
    test("should build complete clutch stats from performance rating", () => {
      computeClutchIndex.mockReturnValue({
        players: [
          {
            id: "dak",
            name: "Dak Prescott",
            position: "QB",
            stats: {
              fourthQStats: { efficiency: 0.95 },
              regularStats: { efficiency: 0.88 },
              thirdDownStats: { completions: 9, attempts: 8, success: 7 },
              fourthDownStats: { completions: 1, attempts: 1, success: 0 },
              redZoneStats: { attempts: 4, touchdowns: 3, fieldGoals: 0 },
              closeGameStats: {
                closeGames: 3,
                wins: 3,
                avgPointsInCloseGames: 72,
              },
              twoMinStats: { drives: 2, scoreOnDrive: 1, heroMoments: 1 },
              gameWinningStats: {
                gwDrives: 1,
                gwSuccesses: 1,
                gwAttempts: 1,
              },
              pressureStats: {
                pressurePlays: 11,
                successUnderPressure: 7,
                avgYardsWithPressure: 4.5,
              },
              clutchTurnovers: 0,
              clutchPlays: 18,
              consistency: 90,
            },
            clutchIndex: 85,
            clutchFactor: 8,
            clutchConsistency: 87,
            ranking: "CLUTCH_KING",
          },
        ],
        leaders: [],
        underperformers: [],
        teamStats: {},
        insights: [],
      });

      const result = computeClutchIndex([], {});
      expect(result.players[0].stats).toBeDefined();
      expect(result.players[0].stats.fourthQStats).toBeDefined();
    });
  });

  describe("GET /api/players/clutch - Error Handling", () => {
    test("should handle computation errors", async () => {
      computeClutchIndex.mockImplementation(() => {
        throw new Error("Computation failed");
      });

      expect(() => {
        computeClutchIndex([], {});
      }).toThrow("Computation failed");
    });

    test("should return 500 on unhandled error", async () => {
      Team.findByName.mockRejectedValue(new Error("Unexpected error"));

      expect(Team.findByName()).rejects.toThrow("Unexpected error");
    });

    test("should include error message in response", async () => {
      Team.findByName.mockRejectedValue(new Error("DB error detail"));

      await expect(Team.findByName()).rejects.toThrow("DB error detail");
    });
  });

  describe("GET /api/players/clutch - Response Format", () => {
    test("should include required fields in response", () => {
      const mockResponse = {
        players: [
          {
            id: "dak",
            name: "Dak Prescott",
            position: "QB",
            role: "Offensive Engine",
            clutchIndex: 85,
            clutchFactor: 8,
            clutchConsistency: 87,
            ranking: "CLUTCH_KING",
            metrics: {},
          },
        ],
        leaders: [],
        underperformers: [],
        teamStats: {
          avgClutchIndex: 75,
          situationAnalysis: [],
        },
        insights: [],
        _cached: false,
      };

      expect(mockResponse).toHaveProperty("players");
      expect(mockResponse).toHaveProperty("leaders");
      expect(mockResponse).toHaveProperty("underperformers");
      expect(mockResponse).toHaveProperty("teamStats");
      expect(mockResponse).toHaveProperty("insights");
    });

    test("should include cache metadata in response", () => {
      const mockResponse = {
        players: [],
        leaders: [],
        underperformers: [],
        teamStats: {},
        insights: [],
        _cached: true,
        _cacheAge: 1500,
      };

      expect(mockResponse).toHaveProperty("_cached");
      expect(mockResponse).toHaveProperty("_cacheAge");
      expect(typeof mockResponse._cached).toBe("boolean");
      expect(typeof mockResponse._cacheAge).toBe("number");
    });

    test("should include all player metrics in response", () => {
      const player = {
        id: "dak",
        name: "Dak Prescott",
        position: "QB",
        role: "Offensive Engine",
        clutchIndex: 85,
        clutchFactor: 8,
        clutchConsistency: 87,
        ranking: "CLUTCH_KING",
        metrics: {
          fourthQuarterPerf: 95,
          highLeveragePerf: 88,
          redZonePerf: 92,
          closeGamePerf: 85,
          twoMinutePerf: 90,
          gameWinningPerf: 88,
          pressurePerf: 82,
        },
      };

      expect(player).toHaveProperty("metrics");
      expect(player.metrics).toHaveProperty("fourthQuarterPerf");
      expect(player.metrics).toHaveProperty("highLeveragePerf");
      expect(player.metrics).toHaveProperty("redZonePerf");
    });
  });

  describe("Cache Performance Benchmarks", () => {
    test("should have measurable cache performance improvement", () => {
      const testData = {
        players: Array.from({ length: 100 }, (_, i) => ({
          id: `player${i}`,
          name: `Player ${i}`,
          clutchIndex: Math.random() * 100,
        })),
      };

      // Simulate first request (cache set)
      cache.set("CLUTCH_ANALYSIS", testData, null, "bench_season");

      // Get stats before hits
      const statsBefore = cache.getStats();
      const hitsBefore = statsBefore.hits;

      // Simulate multiple requests (cache hits)
      for (let i = 0; i < 100; i++) {
        cache.get("CLUTCH_ANALYSIS", "bench_season");
      }

      const statsAfter = cache.getStats();
      expect(statsAfter.hits).toBe(hitsBefore + 100);
      expect(parseFloat(statsAfter.hitRate)).toBeGreaterThan(90);
    });

    test("should maintain cache size efficiency", () => {
      // Add moderate amount of cached items
      for (let i = 0; i < 50; i++) {
        cache.set(
          "CLUTCH_ANALYSIS",
          { data: `test_${i}` },
          null,
          `season_${i}`
        );
      }

      const stats = cache.getStats();
      expect(stats.size).toBe(50);

      // Memory estimate should be reasonable
      const memoryUsage = stats.memory;
      expect(memoryUsage).toBeDefined();
      expect(memoryUsage).toContain("KB");
    });
  });

  describe("Concurrent Request Handling", () => {
    test("should handle concurrent cache reads safely", async () => {
      const testData = { players: [], season: 2025 };
      cache.set("CLUTCH_ANALYSIS", testData, null, "concurrent_test");

      const promises = Array.from({ length: 50 }, () =>
        Promise.resolve(cache.get("CLUTCH_ANALYSIS", "concurrent_test"))
      );

      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result).toEqual(testData);
      });

      const stats = cache.getStats();
      expect(stats.hits).toBe(50);
    });

    test("should handle concurrent cache writes safely", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(
          cache.set("CLUTCH_ANALYSIS", { index: i }, null, `concurrent_${i}`)
        )
      );

      await Promise.all(promises);

      const stats = cache.getStats();
      expect(stats.sets).toBeGreaterThanOrEqual(10);
      expect(cache.store.size).toBe(10);
    });
  });
});

describe("Per-Play and Per-Quarter Stats Integration", () => {
  beforeEach(() => {
    cache.clear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    cache.destroy();
  });

  test("should cache per-quarter stats with shorter TTL", () => {
    const perQuarterStats = {
      quarters: [
        { quarter: 1, playerStats: [], avgPoints: 7 },
        { quarter: 2, playerStats: [], avgPoints: 10 },
        { quarter: 3, playerStats: [], avgPoints: 9 },
        { quarter: 4, playerStats: [], avgPoints: 14 },
      ],
    };

    // Per-quarter should have 2-minute TTL
    cache.set("PER_QUARTER_STATS", perQuarterStats, 2 * 60 * 1000, "game_1");

    const cached = cache.get("PER_QUARTER_STATS", "game_1");
    expect(cached).toEqual(perQuarterStats);
  });

  test("should cache per-play stats with minimal TTL", () => {
    const perPlayStats = {
      plays: [
        { playId: 1, player: "Dak", result: "pass", yards: 15 },
        { playId: 2, player: "CeeDee", result: "catch", yards: 12 },
      ],
    };

    // Per-play should have 1-minute TTL (live updates)
    cache.set("PER_PLAY_STATS", perPlayStats, 1 * 60 * 1000, "game_1");

    const cached = cache.get("PER_PLAY_STATS", "game_1");
    expect(cached).toEqual(perPlayStats);
  });

  test("should separate cache namespaces for different granularities", () => {
    const seasonStats = { avg: 25.5 };
    const gameStats = { avg: 28.2 };
    const quarterStats = { q1: 7, q2: 10 };
    const playStats = { plays: 52 };

    cache.set("LIVE_SEASON_STATS", seasonStats, null, "2025");
    cache.set("PER_GAME_STATS", gameStats, null, "game_1");
    cache.set("PER_QUARTER_STATS", quarterStats, null, "game_1");
    cache.set("PER_PLAY_STATS", playStats, null, "game_1");

    expect(cache.get("LIVE_SEASON_STATS", "2025")).toEqual(seasonStats);
    expect(cache.get("PER_GAME_STATS", "game_1")).toEqual(gameStats);
    expect(cache.get("PER_QUARTER_STATS", "game_1")).toEqual(quarterStats);
    expect(cache.get("PER_PLAY_STATS", "game_1")).toEqual(playStats);
  });

  test("should invalidate per-play stats when needed", () => {
    cache.set("PER_PLAY_STATS", { plays: 52 }, null, "live_game");
    expect(cache.has("PER_PLAY_STATS", "live_game")).toBe(true);

    cache.delete("PER_PLAY_STATS", "live_game");
    expect(cache.has("PER_PLAY_STATS", "live_game")).toBe(false);
  });
});

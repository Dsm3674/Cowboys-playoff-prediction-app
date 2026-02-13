/**
 * timeline.jest.js - Jest test suite for timeline functionality
 */

const request = require("supertest");
const express = require("express");
const db = require("../databases");
const timeline = require("../timeline");

// Mock the database
jest.mock("../databases");

// Mock cache
jest.mock("../cache");
const cache = require("../cache");

const timelineRouter = require("../routes/timeline");

describe("Timeline Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("detectInflectionPoints", () => {
    it("should detect local peaks", () => {
      const points = [
        { date: "2024-01-01", value: 5 },
        { date: "2024-01-02", value: 7 },
        { date: "2024-01-03", value: 10 }, // Peak
        { date: "2024-01-04", value: 8 },
        { date: "2024-01-05", value: 6 },
      ];

      const inflections = timeline.detectInflectionPoints(points);

      expect(inflections).toContainEqual(
        expect.objectContaining({
          date: "2024-01-03",
          type: "peak",
          value: 10,
        })
      );
    });

    it("should detect local valleys", () => {
      const points = [
        { date: "2024-01-01", value: 8 },
        { date: "2024-01-02", value: 6 },
        { date: "2024-01-03", value: 2 }, // Valley
        { date: "2024-01-04", value: 5 },
        { date: "2024-01-05", value: 7 },
      ];

      const inflections = timeline.detectInflectionPoints(points);

      expect(inflections).toContainEqual(
        expect.objectContaining({
          date: "2024-01-03",
          type: "valley",
          value: 2,
        })
      );
    });

    it("should detect multiple inflection points", () => {
      const points = [
        { date: "2024-01-01", value: 5 },
        { date: "2024-01-02", value: 8 }, // Peak
        { date: "2024-01-03", value: 4 }, // Valley
        { date: "2024-01-04", value: 9 }, // Peak
        { date: "2024-01-05", value: 3 }, // Valley
        { date: "2024-01-06", value: 6 },
      ];

      const inflections = timeline.detectInflectionPoints(points);

      expect(inflections.length).toBe(4);
      expect(inflections.filter((p) => p.type === "peak")).toHaveLength(2);
      expect(inflections.filter((p) => p.type === "valley")).toHaveLength(2);
    });

    it("should return empty array for less than 3 points", () => {
      const points = [
        { date: "2024-01-01", value: 5 },
        { date: "2024-01-02", value: 7 },
      ];

      const inflections = timeline.detectInflectionPoints(points);

      expect(inflections).toEqual([]);
    });

    it("should ignore monotonic sequences", () => {
      const points = [
        { date: "2024-01-01", value: 3 },
        { date: "2024-01-02", value: 5 },
        { date: "2024-01-03", value: 7 },
        { date: "2024-01-04", value: 9 },
      ];

      const inflections = timeline.detectInflectionPoints(points);

      expect(inflections).toEqual([]);
    });
  });

  describe("getTimelineData", () => {
    it("should aggregate player events into timeline points", async () => {
      const mockEvents = [
        {
          event_date: "2024-01-15T10:00:00",
          impact_score: 8,
          event_type: "injury",
        },
        {
          event_date: "2024-01-15T14:00:00",
          impact_score: 6,
          event_type: "return",
        },
        {
          event_date: "2024-02-20T09:00:00",
          impact_score: 9,
          event_type: "performance_peak",
        },
      ];

      db.query.mockResolvedValueOnce({ rows: mockEvents });

      const result = await timeline.getTimelineData(2024);

      expect(result.season).toBe(2024);
      expect(result.points.length).toBeGreaterThan(0);
      expect(result.eventCount).toBe(3);
      expect(result.points[0].date).toBeDefined();
      expect(result.points[0].value).toBeDefined();
    });

    it("should detect inflection points in timeline", async () => {
      // Create points that form peaks/valleys
      const mockEvents = [];
      for (let i = 1; i <= 9; i++) {
        mockEvents.push({
          event_date: `2024-01-${String(i).padStart(2, "0")}T10:00:00`,
          impact_score: i <= 3 ? i + 5 : i <= 6 ? 10 - i : i - 2,
          event_type: "injury",
        });
      }

      db.query.mockResolvedValueOnce({ rows: mockEvents });

      const result = await timeline.getTimelineData(2024);

      expect(result.inflectionPoints.length).toBeGreaterThan(0);
    });

    it("should generate synthetic timeline if no events", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await timeline.getTimelineData(2024);

      expect(result.season).toBe(2024);
      expect(result.points.length).toBeGreaterThan(0);
      expect(result.eventCount).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      db.query.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await timeline.getTimelineData(2024);

      expect(result.season).toBe(2024);
      expect(result.points).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it("should sort points chronologically", async () => {
      const mockEvents = [
        {
          event_date: "2024-03-01T10:00:00",
          impact_score: 5,
          event_type: "injury",
        },
        {
          event_date: "2024-01-15T10:00:00",
          impact_score: 7,
          event_type: "return",
        },
        {
          event_date: "2024-02-20T10:00:00",
          impact_score: 6,
          event_type: "injury",
        },
      ];

      db.query.mockResolvedValueOnce({ rows: mockEvents });

      const result = await timeline.getTimelineData(2024);

      for (let i = 1; i < result.points.length; i++) {
        const prevDate = new Date(result.points[i - 1].date);
        const currDate = new Date(result.points[i].date);
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
      }
    });
  });

  describe("getInflectionPoints", () => {
    it("should return only inflection points without full timeline", async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            event_date: "2024-01-01T10:00:00",
            impact_score: 8,
            event_type: "injury",
          },
          {
            event_date: "2024-01-02T10:00:00",
            impact_score: 5,
            event_type: "injury",
          },
          {
            event_date: "2024-01-03T10:00:00",
            impact_score: 9,
            event_type: "return",
          },
        ],
      });

      const result = await timeline.getInflectionPoints(2024);

      expect(result.season).toBe(2024);
      expect(result.inflectionPoints).toBeDefined();
      expect(Array.isArray(result.inflectionPoints)).toBe(true);
    });
  });
});

describe("Timeline API Routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/timeline", timelineRouter);

    jest.clearAllMocks();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
  });

  describe("GET /api/timeline/points", () => {
    it("should return timeline points for season", async () => {
      const mockTimelineData = {
        season: 2024,
        points: [
          { date: "2024-01-01T00:00:00", value: 5.5 },
          { date: "2024-02-01T00:00:00", value: 7.2 },
        ],
        inflectionPoints: [
          { date: "2024-02-01T00:00:00", type: "peak", value: 7.2 },
        ],
        eventCount: 5,
      };

      jest.spyOn(timeline, "getTimelineData").mockResolvedValueOnce(mockTimelineData);

      const res = await request(app)
        .get("/api/timeline/points")
        .query({ season: 2024 });

      expect(res.status).toBe(200);
      expect(res.body.season).toBe(2024);
      expect(res.body.points).toHaveLength(2);
      expect(res.body.inflectionPoints).toHaveLength(1);
    });

    it("should use cache when available", async () => {
      const cachedData = {
        season: 2024,
        points: [{ date: "2024-01-01", value: 5.5 }],
        inflectionPoints: [],
        eventCount: 1,
      };

      cache.get.mockResolvedValueOnce(cachedData);

      const res = await request(app)
        .get("/api/timeline/points")
        .query({ season: 2024 });

      expect(res.status).toBe(200);
      expect(res.body._cached).toBe(true);
    });

    it("should cache results for 10 minutes", async () => {
      jest.spyOn(timeline, "getTimelineData").mockResolvedValueOnce({
        season: 2024,
        points: [],
        inflectionPoints: [],
        eventCount: 0,
      });

      await request(app)
        .get("/api/timeline/points")
        .query({ season: 2024 });

      expect(cache.set).toHaveBeenCalledWith(
        "TIMELINE_POINTS",
        expect.any(String),
        expect.any(Object),
        600 // 10 minutes
      );
    });

    it("should default to current year season", async () => {
      jest.spyOn(timeline, "getTimelineData").mockResolvedValueOnce({
        season: new Date().getFullYear(),
        points: [],
        inflectionPoints: [],
        eventCount: 0,
      });

      const res = await request(app)
        .get("/api/timeline/points");

      expect(res.status).toBe(200);
      expect(res.body.season).toBe(new Date().getFullYear());
    });

    it("should handle errors gracefully", async () => {
      jest
        .spyOn(timeline, "getTimelineData")
        .mockResolvedValueOnce({
          season: 2024,
          points: [],
          inflectionPoints: [],
          eventCount: 0,
          error: "Database connection failed",
        });

      const res = await request(app)
        .get("/api/timeline/points")
        .query({ season: 2024 });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/timeline/inflections", () => {
    it("should return only inflection points", async () => {
      const mockInflections = {
        season: 2024,
        inflectionPoints: [
          {
            date: "2024-01-15T00:00:00",
            type: "peak",
            value: 8.5,
            description: "Performance peak",
          },
        ],
      };

      jest.spyOn(timeline, "getInflectionPoints").mockResolvedValueOnce(mockInflections);

      const res = await request(app)
        .get("/api/timeline/inflections")
        .query({ season: 2024 });

      expect(res.status).toBe(200);
      expect(res.body.inflectionPoints).toHaveLength(1);
      expect(res.body.inflectionPoints[0].type).toBe("peak");
    });

    it("should use separate cache for inflections", async () => {
      jest.spyOn(timeline, "getInflectionPoints").mockResolvedValueOnce({
        season: 2024,
        inflectionPoints: [],
      });

      await request(app)
        .get("/api/timeline/inflections")
        .query({ season: 2024 });

      expect(cache.set).toHaveBeenCalledWith(
        "TIMELINE_POINTS",
        expect.stringContaining("inflections"),
        expect.any(Object),
        600
      );
    });
  });
});

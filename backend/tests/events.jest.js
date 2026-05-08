/**
 * events.jest.js - Jest test suite for player events endpoints
 */

const request = require("supertest");
const express = require("express");
const db = require("../databases");

// Mock the database
jest.mock("../databases");

// Mock cache
jest.mock("../cache");
const cache = require("../cache");

const playersRouter = require("../routes/players");

describe("Player Events API", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/players", playersRouter);

    // Reset mocks
    jest.clearAllMocks();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    cache.delete.mockResolvedValue(undefined);
  });

  describe("POST /api/players/events - Create Event", () => {
    it("should create a new player event", async () => {
      const eventData = {
        player_name: "Dak Prescott",
        event_type: "injury",
        event_date: "2024-01-15",
        description: "Hamstring injury",
        impact_score: 8,
        season: 2024,
      };

      db.query.mockResolvedValueOnce({
        rows: [{ ...eventData, id: 1, created_at: new Date() }],
      });

      const res = await request(app)
        .post("/api/players/events")
        .send(eventData);

      expect(res.status).toBe(201);
      expect(res.body.player_name).toBe("Dak Prescott");
      expect(res.body.event_type).toBe("injury");
      expect(cache.delete).toHaveBeenCalledWith(
        "PLAYER_EVENTS",
        expect.any(String)
      );
    });

    it("should return 400 if required fields are missing", async () => {
      const incompleteData = {
        player_name: "Dak Prescott",
        // missing event_type and event_date
      };

      const res = await request(app)
        .post("/api/players/events")
        .send(incompleteData);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("required");
    });

    it("should handle upsert on duplicate event", async () => {
      const eventData = {
        player_name: "CeeDee Lamb",
        event_type: "performance_peak",
        event_date: "2024-02-20",
        description: "Exceptional game",
        impact_score: 9,
        season: 2024,
      };

      db.query.mockResolvedValueOnce({
        rows: [{ ...eventData, id: 2, updated_at: new Date() }],
      });

      const res = await request(app)
        .post("/api/players/events")
        .send(eventData);

      expect(res.status).toBe(201);
      expect(cache.delete).toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const eventData = {
        player_name: "Micah Parsons",
        event_type: "injury",
        event_date: "2024-01-20",
      };

      db.query.mockRejectedValueOnce(new Error("Database connection failed"));

      const res = await request(app)
        .post("/api/players/events")
        .send(eventData);

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("database");
    });
  });

  describe("GET /api/players/events - Fetch Events", () => {
    it("should return recent player events", async () => {
      const mockEvents = [
        {
          id: 1,
          player_name: "Dak Prescott",
          event_type: "injury",
          event_date: "2024-01-15",
          description: "Hamstring injury",
          impact_score: 8,
          season: 2024,
        },
        {
          id: 2,
          player_name: "CeeDee Lamb",
          event_type: "performance_peak",
          event_date: "2024-02-20",
          description: "Exceptional game",
          impact_score: 9,
          season: 2024,
        },
      ];

      db.query.mockResolvedValueOnce({ rows: mockEvents });

      const res = await request(app)
        .get("/api/players/events")
        .query({ season: 2024, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
      expect(res.body.season).toBe(2024);
      expect(res.body.count).toBe(2);
    });

    it("should respect limit parameter", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get("/api/players/events")
        .query({ limit: 1000 });

      // Verify limit was capped at 500
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 500"),
        expect.any(Array)
      );
    });

    it("should use cache when available", async () => {
      const cachedData = {
        events: [{ player_name: "Dak Prescott", event_type: "injury" }],
        season: 2024,
        count: 1,
      };

      cache.get.mockResolvedValueOnce(cachedData);

      const res = await request(app)
        .get("/api/players/events")
        .query({ season: 2024 });

      expect(res.status).toBe(200);
      expect(res.body._cached).toBe(true);
      expect(db.query).not.toHaveBeenCalled();
    });

    it("should return empty events on database error", async () => {
      db.query.mockRejectedValueOnce(new Error("Query failed"));

      const res = await request(app)
        .get("/api/players/events")
        .query({ season: 2024 });

      expect(res.status).toBe(200);
      expect(res.body.events).toEqual([]);
      expect(res.body.error).toBeUndefined(); // No error exposed
    });

    it("should filter by season", async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            player_name: "Ezekiel Elliott",
            event_type: "signing",
            event_date: "2023-03-10",
            season: 2023,
          },
        ],
      });

      const res = await request(app)
        .get("/api/players/events")
        .query({ season: 2023, limit: 50 });

      expect(res.status).toBe(200);
      expect(res.body.events[0].season).toBe(2023);
    });
  });

  describe("GET /api/players/search - Player Autocomplete", () => {
    it("should return player suggestions", async () => {
      const mockPlayers = [
        { player_name: "Dak Prescott", position: "QB", performance_rating: 8.5 },
        { player_name: "Dakota Prescott", position: "QB", performance_rating: 7.0 },
      ];

      db.query.mockResolvedValueOnce({ rows: mockPlayers });

      const res = await request(app)
        .get("/api/players/search")
        .query({ name: "dak" });

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("should require minimum 2 characters", async () => {
      const res = await request(app)
        .get("/api/players/search")
        .query({ name: "d" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]); // Should return empty
    });

    it("should limit results to 20", async () => {
      const many = Array.from({ length: 30 }, (_, i) => ({
        player_name: `Player ${i}`,
        position: "WR",
        performance_rating: 5 + Math.random() * 3,
      }));

      db.query.mockResolvedValueOnce({ rows: many });

      const res = await request(app)
        .get("/api/players/search")
        .query({ name: "player" });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(20);
    });

    it("should fallback to static Cowboys roster on db error", async () => {
      db.query.mockRejectedValueOnce(new Error("Database down"));

      const res = await request(app)
        .get("/api/players/search")
        .query({ name: "dak" });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(
        res.body.some((p) => p.player_name === "Dak Prescott" || p === "Dak Prescott")
      ).toBe(true);
    });

    it("should use cache for search results", async () => {
      const cachedResults = [{ player_name: "Dak Prescott" }];
      cache.get.mockResolvedValueOnce(cachedResults);

      const res = await request(app)
        .get("/api/players/search")
        .query({ name: "dak" });

      expect(res.status).toBe(200);
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe("Event-related Database Queries", () => {
    it("should use correct SQL for creating events", async () => {
      const eventData = {
        player_name: "Brandin Cooks",
        event_type: "injury",
        event_date: "2024-03-05",
        description: "Shoulder injury",
        impact_score: 7,
        season: 2024,
      };

      db.query.mockResolvedValueOnce({ rows: [eventData] });

      await request(app)
        .post("/api/players/events")
        .send(eventData);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain("INSERT");
      expect(query).toContain("ON CONFLICT");
    });

    it("should invalidate cache on event creation", async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            player_name: "Test Player",
            event_type: "injury",
            event_date: "2024-01-01",
          },
        ],
      });

      await request(app)
        .post("/api/players/events")
        .send({
          player_name: "Test Player",
          event_type: "injury",
          event_date: "2024-01-01",
        });

      expect(cache.delete).toHaveBeenCalledWith(
        "PLAYER_EVENTS",
        expect.any(String)
      );
      expect(cache.delete).toHaveBeenCalledWith(
        "TIMELINE_POINTS",
        expect.any(String)
      );
    });
  });
});

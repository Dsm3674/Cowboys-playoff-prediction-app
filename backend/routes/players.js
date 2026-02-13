const express = require("express");
const router = express.Router();
const Team = require("../teams");
const Season = require("../seasons");
const pool = require("../databases");
const cache = require("../cache");
const { computeConsistencyExplosiveness } = require("../Maps");
const { computeClutchIndex } = require("../clutch");

router.get("/radar", async (req, res) => {
  try {
    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) {
      return res.status(404).json({ error: "Cowboys team not found" });
    }

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason) {
      return res.status(404).json({ error: "No current season data" });
    }

    // Try to pull players from DB; if table/columns differ, fall back to static
    let players = [];
    try {
      const result = await pool.query(
        "SELECT * FROM players WHERE season_id = $1 ORDER BY performance_rating DESC LIMIT 20",
        [currentSeason.season_id]
      );
      players = result.rows;
    } catch (err) {
      console.warn(
        "Player radar: players table query failed, falling back to static data:",
        err.message
      );
      players = [];
    }

    const findByName = (name) =>
      players.find((p) =>
        (p.player_name || "").toLowerCase().includes(name.toLowerCase())
      );

    // 🔵 Dak Prescott
    const dak = findByName("prescott") || {
      player_name: "Dak Prescott",
      position: "QB",
      performance_rating: 90,
    };

    // 🟠 CeeDee Lamb
    const ceedee = findByName("lamb") || {
      player_name: "CeeDee Lamb",
      position: "WR",
      performance_rating: 92,
    };

    // 🔵 Daron Bland (instead of Micah)
    const bland = findByName("bland") || {
      player_name: "Daron Bland",
      position: "CB",
      performance_rating: 88,
    };

    const buildMetrics = (p) => {
      const base = Number(p.performance_rating) || 85;
      const name = (p.player_name || "").toLowerCase();
      const pos = (p.position || "").toUpperCase();

      // You can tweak these heuristics later if you connect real model outputs
      const offense =
        pos === "QB" || name.includes("prescott")
          ? Math.min(99, base + 4)
          : pos === "WR" || name.includes("lamb")
          ? Math.min(99, base + 3)
          : Math.max(70, base - 4);

      const explosiveness =
        pos === "WR" || name.includes("lamb")
          ? Math.min(99, base + 6)
          : Math.max(70, base - 2);

      const consistency = Math.max(70, base - 1);
      const clutch = Math.min(99, base + 2);

      // For Bland, treat "durability" as ball-hawk / availability vibe
      const durability =
        name.includes("bland") || pos === "CB"
          ? Math.min(99, base + 3)
          : Math.max(65, base - 5);

      return { offense, explosiveness, consistency, clutch, durability };
    };

    const labels = [
      "Offense",
      "Explosiveness",
      "Consistency",
      "Clutch",
      "Durability",
    ];

    const response = {
      labels,
      players: [
        {
          id: "dak",
          name: dak.player_name,
          position: dak.position || "QB",
          metrics: buildMetrics(dak),
          role: "Offensive Engine",
        },
        {
          id: "ceedee",
          name: ceedee.player_name,
          position: ceedee.position || "WR",
          metrics: buildMetrics(ceedee),
          role: "Explosive Playmaker",
        },
        {
          id: "bland",
          name: bland.player_name,
          position: bland.position || "CB",
          metrics: buildMetrics(bland),
          role: "Turnover Machine",
        },
      ],
    };

    res.json(response);
  } catch (error) {
    console.error("Error building player radar:", error);
    res
      .status(500)
      .json({ error: "Failed to build player radar", message: error.message });
  }
});


router.get("/maps", async (req, res) => {
  try {
    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) {
      return res.status(404).json({ error: "Cowboys team not found" });
    }

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason) {
      return res.status(404).json({ error: "No current season data" });
    }

    // Fetch player data
    let players = [];
    try {
      const result = await pool.query(
        "SELECT * FROM players WHERE season_id = $1 ORDER BY performance_rating DESC LIMIT 20",
        [currentSeason.season_id]
      );
      players = result.rows;
    } catch (err) {
      console.warn(
        "Player maps: players table query failed, falling back to static data:",
        err.message
      );
      players = [];
    }

    const findByName = (name) =>
      players.find((p) =>
        (p.player_name || "").toLowerCase().includes(name.toLowerCase())
      );

    // Build player roster
    const dak = findByName("prescott") || {
      player_name: "Dak Prescott",
      position: "QB",
      performance_rating: 90,
    };

    const ceedee = findByName("lamb") || {
      player_name: "CeeDee Lamb",
      position: "WR",
      performance_rating: 92,
    };

    const bland = findByName("bland") || {
      player_name: "Daron Bland",
      position: "CB",
      performance_rating: 88,
    };

    const micah = findByName("parsons") || {
      player_name: "Micah Parsons",
      position: "EDGE",
      performance_rating: 95,
    };

    const ezekiel = findByName("elliott") || {
      player_name: "Ezekiel Elliott",
      position: "RB",
      performance_rating: 78,
    };

    const brandin = findByName("cooks") || {
      player_name: "Brandin Cooks",
      position: "WR",
      performance_rating: 82,
    };

    const buildMetrics = (p) => {
      const base = Number(p.performance_rating) || 85;
      const name = (p.player_name || "").toLowerCase();
      const pos = (p.position || "").toUpperCase();

      const offense =
        pos === "QB" || name.includes("prescott")
          ? Math.min(99, base + 4)
          : pos === "WR" || name.includes("lamb") || name.includes("cooks")
          ? Math.min(99, base + 3)
          : pos === "RB" || name.includes("elliott")
          ? Math.min(99, base + 1)
          : Math.max(70, base - 4);

      const explosiveness =
        pos === "WR" || name.includes("lamb")
          ? Math.min(99, base + 6)
          : pos === "EDGE" || name.includes("parsons")
          ? Math.min(99, base + 5)
          : pos === "RB" || name.includes("elliott")
          ? Math.min(99, base + 2)
          : Math.max(70, base - 2);

      const consistency =
        pos === "EDGE" || name.includes("parsons")
          ? Math.min(99, base + 4)
          : pos === "QB" || name.includes("prescott")
          ? Math.min(99, base + 2)
          : Math.max(60, base - 3);

      const clutch = Math.min(99, base + 2);

      const durability =
        name.includes("bland") || pos === "CB"
          ? Math.min(99, base + 3)
          : pos === "EDGE" || name.includes("parsons")
          ? Math.min(99, base + 2)
          : Math.max(65, base - 5);

      return { offense, explosiveness, consistency, clutch, durability };
    };

    const playerList = [
      {
        id: "dak",
        name: dak.player_name,
        position: dak.position || "QB",
        metrics: buildMetrics(dak),
        role: "Offensive Engine",
      },
      {
        id: "ceedee",
        name: ceedee.player_name,
        position: ceedee.position || "WR",
        metrics: buildMetrics(ceedee),
        role: "Explosive Playmaker",
      },
      {
        id: "bland",
        name: bland.player_name,
        position: bland.position || "CB",
        metrics: buildMetrics(bland),
        role: "Turnover Machine",
      },
      {
        id: "micah",
        name: micah.player_name,
        position: micah.position || "EDGE",
        metrics: buildMetrics(micah),
        role: "Defensive Anchor",
      },
      {
        id: "zeke",
        name: ezekiel.player_name,
        position: ezekiel.position || "RB",
        metrics: buildMetrics(ezekiel),
        role: "Volume Back",
      },
      {
        id: "brandin",
        name: brandin.player_name,
        position: brandin.position || "WR",
        metrics: buildMetrics(brandin),
        role: "Slot Receiver",
      },
    ];

    // Compute consistency vs explosiveness analysis
    const mapData = computeConsistencyExplosiveness(playerList);

    res.json(mapData);
  } catch (error) {
    console.error("Error building player maps:", error);
    res
      .status(500)
      .json({ error: "Failed to build player maps", message: error.message });
  }
});


router.get("/clutch", async (req, res) => {
  try {
    // Check cache first - keyed by season (defaults to 2025)
    const season = req.query.season || 2025;
    const cacheKey = `season_${season}`;

    const cached = cache.get("CLUTCH_ANALYSIS", cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true, _cacheAge: Date.now() - cached._cacheTime });
    }

    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) {
      return res.status(404).json({ error: "Cowboys team not found" });
    }

    const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
    if (!currentSeason) {
      return res.status(404).json({ error: "No current season data" });
    }

    // Fetch player data
    let players = [];
    try {
      const result = await pool.query(
        "SELECT * FROM players WHERE season_id = $1 ORDER BY performance_rating DESC LIMIT 20",
        [currentSeason.season_id]
      );
      players = result.rows;
    } catch (err) {
      console.warn(
        "Player clutch: players table query failed, falling back to static data:",
        err.message
      );
      players = [];
    }

    const findByName = (name) =>
      players.find((p) =>
        (p.player_name || "").toLowerCase().includes(name.toLowerCase())
      );

    // Build player roster with realistic clutch stats
    const dak = findByName("prescott") || {
      player_name: "Dak Prescott",
      position: "QB",
      performance_rating: 90,
    };

    const ceedee = findByName("lamb") || {
      player_name: "CeeDee Lamb",
      position: "WR",
      performance_rating: 92,
    };

    const bland = findByName("bland") || {
      player_name: "Daron Bland",
      position: "CB",
      performance_rating: 88,
    };

    const micah = findByName("parsons") || {
      player_name: "Micah Parsons",
      position: "EDGE",
      performance_rating: 95,
    };

    const ezekiel = findByName("elliott") || {
      player_name: "Ezekiel Elliott",
      position: "RB",
      performance_rating: 78,
    };

    const brandin = findByName("cooks") || {
      player_name: "Brandin Cooks",
      position: "WR",
      performance_rating: 82,
    };

    // Build clutch stats for each player
    const buildClutchStats = (p) => {
      const base = Number(p.performance_rating) || 85;
      const name = (p.player_name || "").toLowerCase();
      const pos = (p.position || "").toUpperCase();

      return {
        stats: {
          fourthQStats: {
            efficiency: Math.min(99, (base + 8) / 100),
          },
          regularStats: {
            efficiency: Math.min(99, base / 100),
          },
          thirdDownStats: {
            completions: Math.floor(base / 10),
            attempts: Math.floor(base / 8),
            success: Math.floor(base / 12),
          },
          fourthDownStats: {
            completions: Math.floor(base / 50),
            attempts: Math.floor(base / 30),
            success: Math.floor(base / 60),
          },
          redZoneStats: {
            attempts: Math.floor(base / 20),
            touchdowns: Math.floor(base / 25),
            fieldGoals: Math.floor(base / 45),
          },
          closeGameStats: {
            closeGames: Math.floor(base / 25),
            wins: Math.floor(base / 30),
            avgPointsInCloseGames: base * 0.8,
          },
          twoMinStats: {
            drives: Math.floor(base / 40),
            scoreOnDrive: Math.floor(base / 50),
            heroMoments: Math.floor(base / 60),
          },
          gameWinningStats: {
            gwDrives: Math.floor(base / 50),
            gwSuccesses: Math.floor(base / 70),
            gwAttempts: Math.floor(base / 40),
          },
          pressureStats: {
            pressurePlays: Math.floor(base / 8),
            successUnderPressure: Math.floor(base / 12),
            avgYardsWithPressure: base / 20,
          },
          clutchTurnovers: pos === "QB" ? Math.floor(base / 100) : 0,
          clutchPlays: Math.floor(base / 5),
          consistency: base,
        },
      };
    };

    const playerList = [
      {
        id: "dak",
        name: dak.player_name,
        position: dak.position || "QB",
        role: "Offensive Engine",
        ...buildClutchStats(dak),
      },
      {
        id: "ceedee",
        name: ceedee.player_name,
        position: ceedee.position || "WR",
        role: "Explosive Playmaker",
        ...buildClutchStats(ceedee),
      },
      {
        id: "bland",
        name: bland.player_name,
        position: bland.position || "CB",
        role: "Turnover Machine",
        ...buildClutchStats(bland),
      },
      {
        id: "micah",
        name: micah.player_name,
        position: micah.position || "EDGE",
        role: "Defensive Anchor",
        ...buildClutchStats(micah),
      },
      {
        id: "zeke",
        name: ezekiel.player_name,
        position: ezekiel.position || "RB",
        role: "Volume Back",
        ...buildClutchStats(ezekiel),
      },
      {
        id: "brandin",
        name: brandin.player_name,
        position: brandin.position || "WR",
        role: "Slot Receiver",
        ...buildClutchStats(brandin),
      },
    ];

    // Compute clutch index analysis
    const clutchData = computeClutchIndex(playerList, { season: parseInt(season) });

    // Cache the result with timestamp
    const responseData = { ...clutchData, _cacheTime: Date.now() };
    await cache.set("CLUTCH_ANALYSIS", responseData, null, cacheKey);

    res.json({ ...responseData, _cached: false });
  } catch (error) {
    console.error("Error building player clutch stats:", error);
    res.status(500).json({
      error: "Failed to build player clutch stats",
      message: error.message,
    });
  }
});

// GET /api/players/search - Search players by name with autocomplete
router.get("/search", async (req, res) => {
  try {
    const query = req.query.name || "";
    if (query.length < 2) {
      return res.json([]);
    }

    // Cache key
    const cacheKey = `search_${query.toLowerCase()}`;
    const cached = await cache.get("PLAYER_SEARCH", cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Try DB first
    let results = [];
    try {
      const queryText = `
        SELECT DISTINCT player_name, position, performance_rating
        FROM players 
        WHERE LOWER(player_name) LIKE LOWER($1)
        LIMIT 20
      `;
      const dbResult = await pool.query(queryText, [`${query}%`]);
      results = dbResult.rows;
    } catch (err) {
      console.warn("Player search query failed:", err.message);
    }

    // Fallback: static Cowboys roster
    if (results.length === 0) {
      const cowboys = [
        { player_name: "Dak Prescott", position: "QB", performance_rating: 90 },
        { player_name: "CeeDee Lamb", position: "WR", performance_rating: 92 },
        { player_name: "Micah Parsons", position: "EDGE", performance_rating: 95 },
        { player_name: "Daron Bland", position: "CB", performance_rating: 88 },
        { player_name: "Ezekiel Elliott", position: "RB", performance_rating: 78 },
        { player_name: "Brandin Cooks", position: "WR", performance_rating: 82 },
      ];
      results = cowboys.filter((p) =>
        p.player_name.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Cache results
    await cache.set("PLAYER_SEARCH", results, null, cacheKey);

    res.json(results);
  } catch (error) {
    console.error("Player search error:", error);
    res.status(500).json({ error: "Search failed", message: error.message });
  }
});

// POST /api/players/events - Create player event
router.post("/events", async (req, res) => {
  try {
    const {
      player_name,
      event_type,
      event_date,
      description,
      impact_score,
      season,
    } = req.body;

    if (!player_name || !event_type || !event_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO player_events (player_name, event_type, event_date, description, impact_score, season)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (player_name, event_date, event_type) DO UPDATE 
        SET description = $4, impact_score = $5, updated_at = NOW()
        RETURNING *;
        `,
        [player_name, event_type, event_date, description || null, impact_score || null, season || 2025]
      );

      // Invalidate cache
      await cache.clearNamespace("PLAYER_EVENTS");
      await cache.clearNamespace("TIMELINE_POINTS");

      res.json(result.rows[0]);
    } catch (err) {
      console.error("DB error creating event:", err);
      res.status(500).json({ error: "Failed to create event" });
    }
  } catch (error) {
    console.error("Event creation error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// GET /api/players/events - Fetch player events
router.get("/events", async (req, res) => {
  try {
    const season = req.query.season || 2025;
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);

    // Cache key
    const cacheKey = `season_${season}_limit_${limit}`;
    const cached = await cache.get("PLAYER_EVENTS", cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    try {
      const result = await pool.query(
        `
        SELECT * FROM player_events 
        WHERE season = $1 
        ORDER BY event_date DESC 
        LIMIT $2;
        `,
        [season, limit]
      );

      const responseData = { events: result.rows, season, count: result.rows.length };
      await cache.set("PLAYER_EVENTS", responseData, null, cacheKey);

      res.json({ ...responseData, _cached: false });
    } catch (err) {
      console.warn("DB query failed, returning empty events:", err.message);
      const responseData = { events: [], season, count: 0 };
      await cache.set("PLAYER_EVENTS", responseData, null, cacheKey);
      res.json({ ...responseData, _cached: false });
    }
  } catch (error) {
    console.error("Events fetch error:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

module.exports = router;

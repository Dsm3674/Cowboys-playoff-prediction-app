

const express = require("express");
const router = express.Router();
const Team = require("../teams");
const Season = require("../seasons");
const pool = require("../databases");


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
    const micah = findByName("parsons") || {
      player_name: "Micah Parsons",
      position: "LB",
      performance_rating: 95,
    };

    const buildMetrics = (p) => {
      const base = Number(p.performance_rating) || 85;

      // Simple derived metrics; you can later swap with real model outputs
      return {
        offense:
          p.position === "QB" || /prescott/i.test(p.player_name)
            ? Math.min(99, base + 4)
            : Math.max(70, base - 2),
        explosiveness:
          p.position === "WR" || /lamb/i.test(p.player_name)
            ? Math.min(99, base + 6)
            : base,
        consistency: Math.max(70, base - 3),
        clutch: Math.min(99, base + 2),
        durability: Math.max(65, base - 8),
      };
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
          name: dak.player_name,
          position: dak.position || "QB",
          metrics: buildMetrics(dak),
        },
        {
          name: ceedee.player_name,
          position: ceedee.position || "WR",
          metrics: buildMetrics(ceedee),
        },
        {
          name: micah.player_name,
          position: micah.position || "LB",
          metrics: buildMetrics(micah),
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

module.exports = router;

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

module.exports = router;

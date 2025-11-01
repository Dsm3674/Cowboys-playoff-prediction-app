const express = require("express");
const router = express.Router();

router.get("/current", async (req, res) => {
  res.json({
    playoff_probability: 72.5,
    division_probability: 45.3,
    conference_probability: 18.7,
    superbowl_probability: 8.2,
    confidence_score: 84.5,
    season: { wins: 8, losses: 5, ties: 0 },
  });
});

module.exports = router;

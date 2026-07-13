const express = require("express");
const router = express.Router();
const Team = require("./teams");
const Season = require("./seasons");
const Prediction = require("./predictions");

const { generateEspnPrediction } = require("./prediction");

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (/^[^@\s]+@gmail\.com$/i.test(normalized)) return normalized;
  // Anonymous cryptographic identities (anon-xxxx-xxxx-xxxx) are valid users too.
  if (/^anon-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(normalized)) {
    return normalized;
  }
  return "";
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((out, part) => {
      const eq = part.indexOf("=");
      if (eq === -1) return out;
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);
      try {
        out[key] = decodeURIComponent(value);
      } catch (_err) {
        out[key] = value;
      }
      return out;
    }, {});
}

function normalizeHistoryId(value) {
  const id = String(value || "").trim();
  if (!id || id.length > 128) return "";
  return /^[a-zA-Z0-9._:-]+$/.test(id) ? id : "";
}

function getHistoryIdentity(req) {
  const cookies = parseCookies(req.headers.cookie);
  return {
    userEmail: normalizeEmail(
      req.get("X-LoneStar-User") ||
        req.get("X-Lonestar-User") ||
        cookies.lsi_user ||
        req.query.user
    ),
    historyClientId: normalizeHistoryId(
      req.get("X-LoneStar-History-Id") ||
        req.get("X-Lonestar-History-Id") ||
        cookies.lsi_history ||
        req.query.historyId
    )
  };
}

/* ---------------------------------------------------
   POST /api/prediction/generate
   Generates a new prediction and saves it to DB
--------------------------------------------------- */
router.post("/generate", async (req, res) => {
  try {
    const { modelType = "RandomForest" } = req.body;
    const identity = getHistoryIdentity(req);

    const cowboys = await Team.findByName("Dallas Cowboys");
    if (!cowboys) {
      return res.status(404).json({ error: "Cowboys not found" });
    }

    const season = await Season.getCurrentSeason(cowboys.team_id);
    if (!season) {
      return res.status(404).json({ error: "No season found" });
    }

    const result = await generateEspnPrediction({
      year: season.year,
      modelType,
    });

    const saved = await Prediction.create({
      seasonId: season.season_id,
      playoffProb: result.playoffProbability,
      divisionProb: Math.min(result.playoffProbability * 0.6, 0.9),
      conferenceProb: Math.min(result.playoffProbability * 0.35, 0.7),
      superbowlProb: Math.min(result.playoffProbability * 0.15, 0.4),
      confidenceScore: Math.round(result.playoffProbability * 100),
      factors: {
        model: result.modelUsed,
        perGameWinProbabilities: result.perGameWinProbabilities,
        expectedWins: result.expectedWins,
        source: "ESPN",
      },
      modelVersion: `espn-mc-${modelType.toLowerCase()}`,
      userEmail: identity.userEmail,
      historyClientId: identity.historyClientId,
    });

    res.json({
      success: true,
      prediction: {
        playoff_probability: saved.playoff_probability,
        division_probability: saved.division_probability,
        conference_probability: saved.conference_probability,
        superbowl_probability: saved.superbowl_probability,
        expected_wins: result.expectedWins,
        record: result.currentRecord,
        model_used: result.modelUsed,
      },
    });
  } catch (err) {
    console.error("Prediction error:", err);
    res.status(500).json({ error: "Prediction failed" });
  }
});


router.get("/history", async (req, res) => {
  try {
    const identity = getHistoryIdentity(req);
    const rows = await Prediction.getHistoryForIdentity(identity, req.query.limit);
    res.json({
      history: rows,
      scope: identity.userEmail ? "gmail" : identity.historyClientId ? "browser" : "none"
    });
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

module.exports = router;

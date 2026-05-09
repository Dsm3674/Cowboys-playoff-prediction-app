"use strict";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { apiLimiter } = require("./middleware/RateLimiter");

const app = express();

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URLS
]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

if (process.env.NODE_ENV !== "production" || process.env.ALLOW_FILE_ORIGIN === "true") {
  allowedOrigins.add("null");
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  }
}));
app.use(express.json({ limit: "1mb" }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
});

// ---------------------------------------------------------------------------
// Health check (was documented in README, never wired up).
// Mount BEFORE any rate limiter or auth so platform health probes never hit
// rate limits and never need credentials.
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "cowboys-playoff-predictor",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
const teamsRoutes = require("./routes/teams");
const cowboysRoutes = require("./routes/cowboys");
const authRoutes = require("./routes/auth");
const billingRoutes = require("./routes/billing");
const predictionRoutes = require("./superbowlPath");
const simulationRoutes = require("./routes/simulation");
const analyticsRoutes = require("./routes/analytics");
const playersRoutes = require("./routes/players");
const timelineRoutes = require("./routes/timeline");

app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/cowboys", cowboysRoutes);
app.use("/api/prediction", predictionRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/simulation", simulationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/timeline", timelineRoutes);

// ---------------------------------------------------------------------------
// API 404 guard.
// Without this, an unmatched /api/* path falls through to the SPA wildcard
// below and returns index.html, which the frontend then tries to JSON.parse.
// ---------------------------------------------------------------------------
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API endpoint not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// ---------------------------------------------------------------------------
// Static SPA + wildcard. The wildcard now ONLY catches non-/api paths because
// the guard above terminates /api/* requests first.
// ---------------------------------------------------------------------------
const frontendPath = path.join(__dirname, "../frontend/dist");
const frontendIndexPath = path.join(frontendPath, "index.html");

function sendFrontendIndex(res) {
  res.set("Cache-Control", "no-store");
  res.sendFile(frontendIndexPath);
}

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendPath, { index: false }));

  app.get("/", generalLimiter, (_req, res) => sendFrontendIndex(res));
  app.get("*", generalLimiter, (_req, res) => sendFrontendIndex(res));
} else {
  app.get("/", generalLimiter, (_req, res) => {
    res.json({
      ok: true,
      service: "cowboys-playoff-predictor",
      message: "API running (frontend not built)",
    });
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

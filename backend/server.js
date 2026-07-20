"use strict";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();

// Railway terminates TLS at its edge, so the x-forwarded-proto header tells us
// the original client protocol. Trust the proxy so Express reads it correctly.
app.set("trust proxy", 1);

// Force HTTPS in production. When the request arrived over plain HTTP, redirect
// the visitor to the same URL on https. Skips localhost and the health probe
// so platform health checks never get a redirect they can't follow.
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const isHttps = req.secure || forwardedProto === "https";
  const isLocal =
    req.hostname === "localhost" || req.hostname === "127.0.0.1";
  if (!isHttps && !isLocal) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// Keep the public site on one canonical HTTPS host. This avoids browsers
// keeping separate security/certificate state for lstar.one and www.lstar.one.
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.hostname === "lstar.one") {
    return res.redirect(301, `https://www.lstar.one${req.originalUrl}`);
  }
  next();
});

// Extra browser security for custom domains. Railway handles the TLS
// certificate, but these headers make browsers consistently prefer HTTPS and
// upgrade any accidental insecure asset URLs.
app.use((req, res, next) => {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  if (isHttps) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  res.setHeader("Content-Security-Policy", "upgrade-insecure-requests");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(cors());

// Stripe webhook needs the raw request body for signature verification.
// Apply raw parser only on that exact path; express.json() will skip it because
// the body parser sets req._body once parsing has happened.
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
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
const warroomRoutes = require("./routes/warroom");
const modelRoutes = require("./routes/model");

app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/cowboys", cowboysRoutes);
app.use("/api/prediction", predictionRoutes);
app.use("/api/simulation", simulationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/warroom", warroomRoutes);
app.use("/api/model", modelRoutes);

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
  app.use(express.static(frontendPath, { index: false, extensions: ["html"] }));

  app.get("/", generalLimiter, (_req, res) => sendFrontendIndex(res));
  app.get("*", generalLimiter, (req, res) => {
    // If the URL looks like a real file (.html, .css, .js, .png, etc.) and
    // express.static didn't already serve it, return 404 rather than masking
    // it with the SPA index.
    if (/\.[a-zA-Z0-9]{1,6}$/.test(req.path)) {
      return res.status(404).send("Not found");
    }
    sendFrontendIndex(res);
  });
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

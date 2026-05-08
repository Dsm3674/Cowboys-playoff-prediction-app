"use strict";

const rateLimit = require("express-rate-limit");

/**
 * General API limiter (safe default for most endpoints)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // allow 100 requests per IP per window
  message: {
    error: "Too Many Requests",
    message: "You are sending too many requests. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Strict limiter for heavy simulation / analytics endpoints
 * (Monte Carlo, win probability, fantasy engines, etc.)
 */
const simulationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // very strict for heavy CPU operations
  message: {
    error: "Quantum Engine Overheating",
    message:
      "High-fidelity simulations are resource intensive. Please wait 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Optional: Medium limiter for semi-heavy endpoints
 */
const analyticsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: {
    error: "Analytics Rate Limit Reached",
    message: "Too many analytics requests. Please slow down."
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  simulationLimiter,
  analyticsLimiter
};

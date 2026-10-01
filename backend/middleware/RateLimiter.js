"use strict";

const rateLimit = require("express-rate-limit");

/*
 * Simulations run on the main thread: a 25k-season run blocks every other
 * request for seconds, so they need their own, tighter limit. Keyed by client
 * IP (server.js sets trust proxy for Railway).
 */

/** Every /api route. Generous: one page view can make a dozen calls. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: "Too many requests. Please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** CPU-heavy simulation routes, and custom (uncached) simulation runs. */
const simulationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { error: "Too many simulation runs. Please wait a few minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, simulationLimiter };

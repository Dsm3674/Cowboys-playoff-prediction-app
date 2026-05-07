"use strict";

const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  message: {
    error: "Too Many Requests",
    message: "Too many authentication attempts. Please wait a few minutes."
  },
  standardHeaders: true,
  legacyHeaders: false
});

function isGmail(email) {
  return /^[^@\s]+@gmail\.com$/i.test(String(email || "").trim());
}

function makeSession(email) {
  return {
    ok: true,
    user: email,
    sessionToken: crypto.randomBytes(24).toString("hex")
  };
}

router.post("/session", authLimiter, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!isGmail(email)) {
    return res.status(400).json({ error: "Use a Gmail address to continue." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  res.json(makeSession(email));
});

// Compatibility for users with an old cached frontend. The current app uses
// /session directly, but older HTML called these OTP endpoints.
router.post("/request-otp", authLimiter, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!isGmail(email)) {
    return res.status(400).json({ error: "Use a Gmail address to continue." });
  }

  res.json({
    challengeId: Buffer.from(email).toString("base64url"),
    expiresInSeconds: 300,
    delivery: { delivered: false, provider: "disabled" },
    devCode: "000000"
  });
});

router.post("/verify-otp", authLimiter, (req, res) => {
  try {
    const email = Buffer.from(String(req.body?.challengeId || ""), "base64url")
      .toString("utf8")
      .trim()
      .toLowerCase();

    if (!isGmail(email)) {
      return res.status(400).json({ error: "Use a Gmail address to continue." });
    }

    res.json(makeSession(email));
  } catch (_err) {
    res.status(400).json({ error: "Two-factor code expired. Request a new code." });
  }
});

module.exports = router;

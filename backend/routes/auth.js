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

router.post("/session", authLimiter, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!isGmail(email)) {
    return res.status(400).json({ error: "Use a Gmail address to continue." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  res.json({
    ok: true,
    user: email,
    sessionToken: crypto.randomBytes(24).toString("hex")
  });
});

module.exports = router;

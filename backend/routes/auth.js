"use strict";

const crypto = require("crypto");
const express = require("express");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const challenges = new Map();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
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

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function makeCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [id, challenge] of challenges.entries()) {
    if (challenge.expiresAt <= now) challenges.delete(id);
  }
}

async function sendOtpEmail(email, code) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[auth] Local 2FA code for ${email}: ${code}`);
    return { delivered: false, provider: "local-dev" };
  }

  const from = process.env.AUTH_FROM_EMAIL || "Cowboys IQ <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Cowboys IQ two-factor code",
      text: `Your Cowboys IQ verification code is ${code}. It expires in 5 minutes.`
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Email provider failed with ${res.status}: ${text}`);
  }

  return { delivered: true, provider: "resend" };
}

router.post("/request-otp", authLimiter, async (req, res) => {
  cleanupExpiredChallenges();

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!isGmail(email)) {
    return res.status(400).json({ error: "Use a Gmail address to continue." });
  }

  const code = makeCode();
  const challengeId = crypto.randomUUID();
  const expiresAt = Date.now() + OTP_TTL_MS;

  challenges.set(challengeId, {
    email,
    codeHash: hashCode(code),
    attempts: 0,
    expiresAt
  });

  try {
    const delivery = await sendOtpEmail(email, code);
    res.json({
      challengeId,
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      delivery,
      devCode: process.env.NODE_ENV === "production" ? undefined : code
    });
  } catch (err) {
    challenges.delete(challengeId);
    res.status(502).json({
      error: "Unable to send two-factor code.",
      message: err.message
    });
  }
});

router.post("/verify-otp", authLimiter, (req, res) => {
  cleanupExpiredChallenges();

  const challengeId = String(req.body?.challengeId || "");
  const code = String(req.body?.code || "").trim();
  const challenge = challenges.get(challengeId);

  if (!challenge) {
    return res.status(400).json({ error: "Two-factor code expired. Request a new code." });
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    challenges.delete(challengeId);
    return res.status(429).json({ error: "Too many incorrect codes. Request a new code." });
  }

  challenge.attempts += 1;

  if (hashCode(code) !== challenge.codeHash) {
    return res.status(401).json({
      error: "Invalid two-factor code.",
      attemptsRemaining: Math.max(MAX_ATTEMPTS - challenge.attempts, 0)
    });
  }

  challenges.delete(challengeId);
  res.json({
    ok: true,
    user: challenge.email,
    sessionToken: crypto.randomBytes(24).toString("hex")
  });
});

module.exports = router;

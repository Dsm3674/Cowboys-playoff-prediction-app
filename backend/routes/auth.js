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

function makeSession(user) {
  return {
    ok: true,
    user,
    sessionToken: crypto.randomBytes(24).toString("hex")
  };
}

// ---------------------------------------------------------------------------
// Anonymous Cryptographic Identity — email-free, password-free signup.
//
// The browser generates an ECDSA P-256 keypair and never sends the private
// key anywhere. Signup and sign-in are the same challenge-response flow:
//   1. POST /anon/challenge  -> server issues a short-lived HMAC-sealed nonce
//   2. client signs the nonce with its private key (WebCrypto)
//   3. POST /anon/verify     -> server checks the signature against the
//      supplied public key and derives the identity from its SHA-256 hash
//
// The identity is `anon-xxxx-xxxx-xxxx` (hash of the public key), so no user
// table is needed — matching the stateless model of the Gmail session above.
// ---------------------------------------------------------------------------

const ANON_SECRET = process.env.ANON_AUTH_SECRET || "lonestar-anon-v1";
const ANON_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ANON_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const usedChallenges = new Map();

function challengeMac(body) {
  return crypto.createHmac("sha256", ANON_SECRET).update(body).digest("hex");
}

function pruneUsedChallenges() {
  const now = Date.now();
  for (const [challenge, expiresAt] of usedChallenges) {
    if (expiresAt <= now) usedChallenges.delete(challenge);
  }
}

function anonIdFromPublicKey(spkiDer) {
  const digest = crypto.createHash("sha256").update(spkiDer).digest();
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += ANON_ALPHABET[digest[i] % ANON_ALPHABET.length];
  }
  return `anon-${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`;
}

router.post("/anon/challenge", authLimiter, (req, res) => {
  const body = `${Date.now()}.${crypto.randomBytes(16).toString("hex")}`;
  res.json({
    challenge: `${body}.${challengeMac(body)}`,
    expiresInSeconds: ANON_CHALLENGE_TTL_MS / 1000
  });
});

router.post("/anon/verify", authLimiter, (req, res) => {
  const challenge = String(req.body?.challenge || "");
  const signatureB64 = String(req.body?.signature || "");
  const publicKeyB64 = String(req.body?.publicKey || "");

  const parts = challenge.split(".");
  if (parts.length !== 3) {
    return res.status(400).json({ error: "Invalid challenge. Request a new one." });
  }

  const [ts, rnd, mac] = parts;
  const expectedMac = challengeMac(`${ts}.${rnd}`);
  if (
    mac.length !== expectedMac.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))
  ) {
    return res.status(400).json({ error: "Invalid challenge. Request a new one." });
  }

  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > ANON_CHALLENGE_TTL_MS) {
    return res.status(400).json({ error: "Challenge expired. Request a new one." });
  }

  pruneUsedChallenges();
  if (usedChallenges.has(challenge)) {
    return res.status(400).json({ error: "Challenge already used. Request a new one." });
  }

  let publicKey;
  let spkiDer;
  try {
    spkiDer = Buffer.from(publicKeyB64, "base64");
    publicKey = crypto.createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  } catch (_err) {
    return res.status(400).json({ error: "Invalid public key." });
  }
  if (publicKey.asymmetricKeyType !== "ec") {
    return res.status(400).json({ error: "Public key must be an ECDSA P-256 key." });
  }

  let valid = false;
  try {
    valid = crypto.verify(
      "sha256",
      Buffer.from(challenge, "utf8"),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signatureB64, "base64")
    );
  } catch (_err) {
    valid = false;
  }
  if (!valid) {
    return res.status(401).json({
      error: "Signature verification failed. Check your identity key and try again."
    });
  }

  usedChallenges.set(challenge, Number(ts) + ANON_CHALLENGE_TTL_MS);

  const anonId = anonIdFromPublicKey(spkiDer);
  res.json({ ...makeSession(anonId), anonId });
});

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

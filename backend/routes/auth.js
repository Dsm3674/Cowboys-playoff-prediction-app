"use strict";

const crypto = require("crypto");
const { promisify } = require("util");
const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../databases");
const { createSessionToken } = require("../middleware/sessionAuth");

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
    sessionToken: createSessionToken(user)
  };
}

const scrypt = promisify(crypto.scrypt);
const PASSWORD_KEY_BYTES = 64;
let usersTableReady = false;

async function ensureUsersTable() {
  if (usersTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      theme_preference VARCHAR(20) DEFAULT 'cowboys',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query("ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(255)");
  usersTableReady = true;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, PASSWORD_KEY_BYTES);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltB64, hashB64, ...extra] = String(storedHash || "").split("$");
  if (algorithm !== "scrypt" || !saltB64 || !hashB64 || extra.length) return false;
  try {
    const expected = Buffer.from(hashB64, "base64url");
    const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_error) {
    return false;
  }
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

const ANON_SECRET =
  process.env.ANON_AUTH_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "lonestar-anon-development-v1");
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
  if (!ANON_SECRET) {
    return res.status(503).json({
      error: "Anonymous authentication is not configured. Set ANON_AUTH_SECRET."
    });
  }
  const body = `${Date.now()}.${crypto.randomBytes(16).toString("hex")}`;
  res.json({
    challenge: `${body}.${challengeMac(body)}`,
    expiresInSeconds: ANON_CHALLENGE_TTL_MS / 1000
  });
});

router.post("/anon/verify", authLimiter, (req, res) => {
  if (!ANON_SECRET) {
    return res.status(503).json({
      error: "Anonymous authentication is not configured. Set ANON_AUTH_SECRET."
    });
  }
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

// ---------------------------------------------------------------------------
// Email one-time codes — shared by Gmail signup 2FA and password reset.
//
// Stateless like everything else here: the challengeId is an HMAC-sealed
// payload (email, purpose, timestamp) and the 6-digit code is derived from
// that payload with the same secret, so verification just recomputes both.
// Codes are delivered via Resend when RESEND_API_KEY is configured; otherwise
// the code is returned as devCode (same dev-mode pattern as the legacy OTP
// endpoints below).
// ---------------------------------------------------------------------------

const OTP_SECRET =
  process.env.EMAIL_OTP_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "lonestar-otp-development-v1");
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const OTP_EMAIL_FROM =
  process.env.NOTIFICATION_EMAIL_FROM || "LoneStar AI <onboarding@resend.dev>";

function otpCodeFor(payloadB64) {
  const digest = crypto.createHmac("sha256", OTP_SECRET).update(payloadB64).digest();
  return String(digest.readUInt32BE(0) % 1000000).padStart(6, "0");
}

function makeEmailChallenge(email, purpose, extra = {}) {
  if (!OTP_SECRET) {
    const error = new Error("Email verification is not configured. Set EMAIL_OTP_SECRET.");
    error.statusCode = 503;
    throw error;
  }
  const payload = JSON.stringify({
    e: email,
    p: purpose,
    t: Date.now(),
    r: crypto.randomBytes(8).toString("hex"),
    ...extra
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const mac = crypto.createHmac("sha256", OTP_SECRET).update(payloadB64).digest("hex");
  return { challengeId: `${payloadB64}.${mac}`, code: otpCodeFor(payloadB64) };
}

function verifyEmailChallenge(challengeId, code, purpose) {
  if (!OTP_SECRET) {
    return { ok: false, status: 503, error: "Email verification is not configured." };
  }
  const parts = String(challengeId || "").split(".");
  if (parts.length !== 2) {
    return { ok: false, status: 400, error: "Invalid code request. Start over." };
  }

  const [payloadB64, mac] = parts;
  const expectedMac = crypto.createHmac("sha256", OTP_SECRET).update(payloadB64).digest("hex");
  if (
    mac.length !== expectedMac.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))
  ) {
    return { ok: false, status: 400, error: "Invalid code request. Start over." };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch (_err) {
    return { ok: false, status: 400, error: "Invalid code request. Start over." };
  }
  if (payload.p !== purpose || !isGmail(payload.e)) {
    return { ok: false, status: 400, error: "Invalid code request. Start over." };
  }

  const age = Date.now() - Number(payload.t);
  if (!Number.isFinite(age) || age < 0 || age > OTP_TTL_MS) {
    return { ok: false, status: 400, error: "Code expired. Request a new one." };
  }

  pruneUsedChallenges();
  if (usedChallenges.has(challengeId)) {
    return { ok: false, status: 400, error: "Code already used. Request a new one." };
  }

  const given = String(code || "").trim();
  const expectedCode = otpCodeFor(payloadB64);
  if (
    given.length !== expectedCode.length ||
    !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expectedCode))
  ) {
    return { ok: false, status: 401, error: "Wrong code. Check your email and try again." };
  }

  usedChallenges.set(challengeId, Number(payload.t) + OTP_TTL_MS);
  return { ok: true, email: payload.e, payload };
}

async function sendCodeEmail(email, code, subject, intro) {
  if (!RESEND_API_KEY) return { delivered: false, provider: "disabled" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: OTP_EMAIL_FROM,
        to: [email],
        subject,
        text:
          `${intro}\n\n` +
          `Your LoneStar AI code: ${code}\n\n` +
          "This code expires in 10 minutes. If you didn't request it, you can ignore this email."
      })
    });
    return { delivered: res.ok, provider: "resend" };
  } catch (_err) {
    return { delivered: false, provider: "resend" };
  }
}

function codeResponse(challengeId, delivery, code) {
  return {
    ok: true,
    challengeId,
    expiresInSeconds: OTP_TTL_MS / 1000,
    delivery,
    // Dev mode only: without an email provider the code has nowhere to go,
    // so surface it in the response (same pattern as the legacy endpoints).
    ...(delivery.delivered || process.env.NODE_ENV === "production" ? {} : { devCode: code })
  };
}

function deliveryUnavailable(res, delivery) {
  if (process.env.NODE_ENV === "production" && !delivery.delivered) {
    res.status(503).json({
      error: "Email delivery is unavailable. Configure RESEND_API_KEY and try again."
    });
    return true;
  }
  return false;
}

// Step 1 of Gmail signup: validate credentials, then email a 2FA code.
router.post("/2fa/start", authLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!isGmail(email)) {
    return res.status(400).json({ error: "Use a Gmail address to continue." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    await ensureUsersTable();
    const existing = await db.query(
      "SELECT 1 FROM users WHERE LOWER(username) = $1 LIMIT 1",
      [email]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: "An account already exists for this Gmail address." });
    }

    const passwordHash = await hashPassword(password);
    const { challengeId, code } = makeEmailChallenge(email, "signup-2fa", {
      h: passwordHash
    });
    const delivery = await sendCodeEmail(
      email,
      code,
      "Your LoneStar AI verification code",
      "Verify your email to finish creating your LoneStar AI account."
    );
    if (deliveryUnavailable(res, delivery)) return;
    res.json(codeResponse(challengeId, delivery, code));
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Unable to start account verification."
    });
  }
});

// Step 2 of Gmail signup: verify the emailed code, then open the session.
router.post("/2fa/verify", authLimiter, async (req, res) => {
  const result = verifyEmailChallenge(req.body?.challengeId, req.body?.code, "signup-2fa");
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  if (!String(result.payload?.h || "").startsWith("scrypt$")) {
    return res.status(400).json({ error: "Invalid signup request. Start over." });
  }

  try {
    await ensureUsersTable();
    const saved = await db.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO NOTHING
       RETURNING user_id`,
      [result.email, result.payload.h]
    );
    if (!saved.rows.length) {
      return res.status(409).json({ error: "An account already exists for this Gmail address." });
    }
    res.json(makeSession(result.email));
  } catch (_error) {
    res.status(500).json({ error: "Unable to create the account right now." });
  }
});

// Forgot password: email a reset code.
router.post("/password/forgot", authLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!isGmail(email)) {
    return res.status(400).json({ error: "Use a Gmail address to continue." });
  }

  try {
    const { challengeId, code } = makeEmailChallenge(email, "password-reset");
    const delivery = await sendCodeEmail(
      email,
      code,
      "Your LoneStar AI password reset code",
      "Use this code to reset your LoneStar AI password."
    );
    if (deliveryUnavailable(res, delivery)) return;
    res.json(codeResponse(challengeId, delivery, code));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Reset password: verify the code and the new password, then sign the user in.
router.post("/password/reset", authLimiter, async (req, res) => {
  const newPassword = String(req.body?.newPassword || "");
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  const result = verifyEmailChallenge(req.body?.challengeId, req.body?.code, "password-reset");
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  try {
    await ensureUsersTable();
    const passwordHash = await hashPassword(newPassword);
    const updated = await db.query(
      `UPDATE users SET password_hash = $1
       WHERE LOWER(username) = $2
       RETURNING user_id`,
      [passwordHash, result.email]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: "No account exists for this Gmail address." });
    }
    res.json({ ...makeSession(result.email), message: "Password updated." });
  } catch (_error) {
    res.status(500).json({ error: "Unable to reset the password right now." });
  }
});

router.post("/session", authLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!isGmail(email)) {
    return res.status(400).json({ error: "Use a Gmail address to continue." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    await ensureUsersTable();
    const result = await db.query(
      `SELECT password_hash FROM users
       WHERE LOWER(username) = $1
       LIMIT 1`,
      [email]
    );
    const valid = result.rows[0] && await verifyPassword(password, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Incorrect Gmail address or password." });
    }
    res.json(makeSession(email));
  } catch (_error) {
    res.status(500).json({ error: "Unable to sign in right now." });
  }
});

// Compatibility for users with an old cached frontend. The current app uses
// /session directly, but older HTML called these OTP endpoints.
router.post("/request-otp", authLimiter, (req, res) => {
  res.status(410).json({
    error: "This legacy sign-in flow is no longer supported. Refresh the app and sign in again."
  });
});

router.post("/verify-otp", authLimiter, (req, res) => {
  res.status(410).json({
    error: "This legacy sign-in flow is no longer supported. Refresh the app and sign in again."
  });
});

module.exports = router;

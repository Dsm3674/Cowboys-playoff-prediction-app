"use strict";

const crypto = require("crypto");

const SESSION_TTL_SECONDS = Math.max(
  300,
  Number(process.env.SESSION_TTL_SECONDS) || 60 * 60 * 24 * 30
);

function sessionSecret() {
  const configured =
    process.env.SESSION_SECRET ||
    process.env.ANON_AUTH_SECRET ||
    process.env.EMAIL_OTP_SECRET;

  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return "";
  return "lonestar-development-session-secret";
}

function sign(value) {
  const secret = sessionSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSessionToken(user) {
  if (!sessionSecret()) {
    const error = new Error("Session authentication is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(user || "").trim().toLowerCase(),
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
      nonce: crypto.randomBytes(12).toString("base64url")
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  const [payloadB64, signature, ...extra] = String(token || "").split(".");
  if (!payloadB64 || !signature || extra.length || !sessionSecret()) return null;
  if (!safeEqual(signature, sign(payloadB64))) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub || !Number.isFinite(payload.exp) || payload.exp <= now) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function tokenFromRequest(req) {
  const authorization = String(req.get?.("authorization") || "");
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  return (
    (bearer && bearer[1]) ||
    req.get?.("x-lonestar-session") ||
    req.body?.sessionToken ||
    ""
  );
}

function getSessionIdentity(req) {
  return verifySessionToken(tokenFromRequest(req))?.sub || "";
}

function requireSession(req, res, next) {
  const user = getSessionIdentity(req);
  if (!user) {
    return res.status(401).json({
      error: "Your session is missing or expired. Sign in again.",
      code: "signin_required"
    });
  }
  req.sessionUser = user;
  next();
}

module.exports = {
  createSessionToken,
  verifySessionToken,
  getSessionIdentity,
  requireSession
};

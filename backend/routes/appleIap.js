"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
const db = require("../databases");
const warroom = require("./warroom");

const router = express.Router();

// ---------------------------------------------------------------------------
// Apple In-App Purchase — War Room Pro on iOS.
//
// Guideline 3.1.1 requires digital content unlocked inside an iOS app to be
// sold through Apple, so the native shell buys via StoreKit 2 while the web
// build keeps using Stripe. Both land in the same `subscriptions` table, so
// isPro() in routes/warroom.js unlocks Pro without knowing which one paid.
//
// Nothing is trusted from the client: the app sends the signed transaction
// (JWS) that StoreKit produced, and it is re-verified here against Apple's
// root certificates before any row is written.
// ---------------------------------------------------------------------------

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || "one.lstar.app";
const PRO_PRODUCT_ID =
  process.env.APPLE_PRO_PRODUCT_ID || "one.lstar.app.pro.monthly";
// Numeric App Store ID (App Store Connect → App Information → Apple ID).
// Apple requires it to verify production notifications; sandbox omits it.
const APP_APPLE_ID = process.env.APPLE_APP_APPLE_ID
  ? Number(process.env.APPLE_APP_APPLE_ID)
  : undefined;
const ROOT_CA_DIR =
  process.env.APPLE_ROOT_CA_DIR || path.join(__dirname, "..", "certs", "apple");

const PLAN = "War Room Pro";
const ACTIVE = "active";

let verifiersPromise = null;

/// Apple's root certificates, read once from disk. Missing certs disable IAP
/// rather than silently accepting unverified purchases.
function loadRootCertificates() {
  let files = [];
  try {
    files = fs
      .readdirSync(ROOT_CA_DIR)
      .filter((name) => /\.(cer|pem|der|crt)$/i.test(name))
      .map((name) => path.join(ROOT_CA_DIR, name));
  } catch (_err) {
    return [];
  }
  return files.map((file) => fs.readFileSync(file));
}

/// One verifier per environment. A sandbox/TestFlight purchase is signed for
/// Sandbox and a live one for Production, and a verifier rejects the other's
/// data outright — so we build both and try each in turn.
async function getVerifiers() {
  if (verifiersPromise) return verifiersPromise;

  verifiersPromise = (async () => {
    const roots = loadRootCertificates();
    if (roots.length === 0) {
      console.error(
        `[apple-iap] no Apple root certificates in ${ROOT_CA_DIR} — IAP verification is disabled`
      );
      return null;
    }

    let SignedDataVerifier;
    let Environment;
    try {
      ({ SignedDataVerifier, Environment } = require("@apple/app-store-server-library"));
    } catch (err) {
      console.error("[apple-iap] @apple/app-store-server-library missing:", err.message);
      return null;
    }

    return [
      new SignedDataVerifier(roots, true, Environment.PRODUCTION, BUNDLE_ID, APP_APPLE_ID),
      new SignedDataVerifier(roots, true, Environment.SANDBOX, BUNDLE_ID, APP_APPLE_ID)
    ];
  })();

  return verifiersPromise;
}

/// Runs `attempt` against each environment's verifier and returns the first
/// success. Both failing means the data really is bad, not merely from the
/// other environment — so the last error is the one worth reporting.
async function verifyAcrossEnvironments(attempt) {
  const verifiers = await getVerifiers();
  if (!verifiers) {
    const err = new Error("Apple IAP verification is not configured on this server.");
    err.statusCode = 503;
    throw err;
  }

  let lastError = null;
  for (const verifier of verifiers) {
    try {
      return await attempt(verifier);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Apple could not verify this purchase.");
}

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

function isGmail(email) {
  return /^[^@\s]+@gmail\.com$/i.test(email);
}

function isAnonIdentity(user) {
  return /^anon-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/i.test(String(user || "").trim());
}

/// Accept only the identity shapes the rest of the app issues, so a purchase
/// can't be attached to an arbitrary string.
function validIdentity(value) {
  const identity = normalizeIdentity(value);
  return isGmail(identity) || isAnonIdentity(identity) ? identity : "";
}

/// Apple reports subscription state through dates rather than a status field.
function statusFor(transaction) {
  if (transaction.revocationDate) return "revoked";
  if (transaction.expiresDate && transaction.expiresDate <= Date.now()) return "expired";
  return ACTIVE;
}

let tableReady = false;

/// Mirrors the schema routes/billing.js creates for Stripe — same table, so
/// whichever route runs first wins and the other is a no-op.
async function ensureSubscriptionsTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      subscription_id VARCHAR(120) PRIMARY KEY,
      customer_id VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      plan VARCHAR(80) NOT NULL,
      status VARCHAR(30) NOT NULL,
      current_period_end TIMESTAMP,
      raw JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_email
    ON subscriptions (email)
  `);
  tableReady = true;
}

/// Writes the Apple subscription into the shared table.
///
/// Renewal notifications carry no LoneStar identity — Apple only knows its own
/// original transaction ID. That's why the row is keyed on that ID and the
/// email is only overwritten when we actually have one: the identity captured
/// at first purchase survives every later renewal.
async function upsertAppleSubscription(transaction, identity) {
  await ensureSubscriptionsTable();

  const subscriptionId = `apple:${transaction.originalTransactionId}`;
  const status = statusFor(transaction);
  const periodEnd = transaction.expiresDate ? new Date(transaction.expiresDate) : null;

  const { rows } = await db.query(
    `
      INSERT INTO subscriptions
        (subscription_id, customer_id, email, plan, status, current_period_end, raw, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (subscription_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        email = COALESCE(NULLIF(EXCLUDED.email, ''), subscriptions.email),
        raw = EXCLUDED.raw,
        updated_at = CURRENT_TIMESTAMP
      RETURNING email
    `,
    [
      subscriptionId,
      subscriptionId,
      identity || "",
      PLAN,
      status,
      periodEnd,
      transaction
    ]
  );

  // isPro() caches for five minutes; drop the entry so a fresh purchase or a
  // refund takes effect on the very next request.
  const owner = rows[0] && rows[0].email;
  if (owner && typeof warroom.invalidatePro === "function") {
    warroom.invalidatePro(owner);
  }

  return { status, periodEnd, owner };
}

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Try again shortly." }
});

// POST /api/billing/apple/verify
// The app calls this after a purchase, after a restore, and on launch.
router.post("/verify", verifyLimiter, async (req, res) => {
  const jws = String(req.body.jws || "").trim();
  if (!jws) {
    return res.status(400).json({ error: "A signed transaction is required." });
  }

  const identity = validIdentity(req.body.user || req.headers["x-lonestar-user"]);

  try {
    const transaction = await verifyAcrossEnvironments((verifier) =>
      verifier.verifyAndDecodeTransaction(jws)
    );

    if (transaction.bundleId !== BUNDLE_ID) {
      return res.status(400).json({ error: "This purchase belongs to a different app." });
    }
    if (transaction.productId !== PRO_PRODUCT_ID) {
      return res.status(400).json({ error: "This purchase is not War Room Pro." });
    }

    const { status, periodEnd } = await upsertAppleSubscription(transaction, identity);

    return res.json({
      pro: status === ACTIVE,
      status,
      expiresAt: periodEnd ? periodEnd.toISOString() : null,
      // Without an identity the entitlement is recorded but can't be tied to
      // an account, so the app knows to ask the user to sign in and re-verify.
      linked: Boolean(identity)
    });
  } catch (error) {
    if (error.statusCode === 503) {
      return res.status(503).json({ error: error.message });
    }
    console.error("[apple-iap] verify failed:", error.message);
    return res.status(400).json({ error: "Apple could not verify this purchase." });
  }
});

// POST /api/billing/apple/notifications
// App Store Server Notifications V2. This is what keeps Pro accurate after the
// purchase: renewals, cancellations, billing failures, refunds and expiries all
// arrive here rather than through the app.
router.post("/notifications", async (req, res) => {
  const signedPayload = String(req.body.signedPayload || "").trim();
  if (!signedPayload) {
    return res.status(400).send("Missing signedPayload");
  }

  try {
    const notification = await verifyAcrossEnvironments((verifier) =>
      verifier.verifyAndDecodeNotification(signedPayload)
    );

    // A TEST notification carries no transaction; acknowledging it is the
    // whole point of the App Store Connect "send test notification" button.
    if (notification.notificationType === "TEST") {
      return res.status(200).send("OK");
    }

    const signedTransactionInfo =
      notification.data && notification.data.signedTransactionInfo;
    if (!signedTransactionInfo) {
      return res.status(200).send("OK");
    }

    const transaction = await verifyAcrossEnvironments((verifier) =>
      verifier.verifyAndDecodeTransaction(signedTransactionInfo)
    );

    if (transaction.productId === PRO_PRODUCT_ID) {
      await upsertAppleSubscription(transaction, "");
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("[apple-iap] notification failed:", error.message);
    // Apple retries on non-2xx, which is what we want for a transient failure.
    return res.status(500).send("Notification handling failed");
  }
});

module.exports = router;

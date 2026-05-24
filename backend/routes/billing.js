const express = require("express");
const rateLimit = require("express-rate-limit");
const fetch = require("node-fetch");
const db = require("../databases");

const router = express.Router();

// ---------------------------------------------------------------------------
// PayPal configuration
// ---------------------------------------------------------------------------
// Set these on Railway:
//   PAYPAL_CLIENT_ID
//   PAYPAL_CLIENT_SECRET
//   PAYPAL_PLAN_ID_WAR_ROOM_PRO   (created in PayPal dashboard, P-XXXX...)
//   PAYPAL_WEBHOOK_ID             (created when adding the webhook endpoint)
//   PAYPAL_MODE                   ("live" or "sandbox", default "live")
// ---------------------------------------------------------------------------

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_PLAN_ID = process.env.PAYPAL_PLAN_ID_WAR_ROOM_PRO || "";
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";
const PAYPAL_MODE = (process.env.PAYPAL_MODE || "live").toLowerCase();

const PAYPAL_API_BASE =
  PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many access requests. Please wait a few minutes."
});

const PLAN_ALLOWLIST = new Set([
  "Educator pilot",
  "War Room Pro",
  "Investor inquiry"
]);

let tableReady = false;
let subscriptionsTableReady = false;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isGmail(email) {
  return /^[^@\s]+@gmail\.com$/i.test(email);
}

async function ensureSubscriptionsTable() {
  if (subscriptionsTableReady) return;
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
  // Provider column is optional history — added defensively so a future
  // multi-provider setup (e.g. PayPal + Stripe) doesn't need a migration.
  await db.query(`
    ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'paypal'
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_email
    ON subscriptions (email)
  `);
  subscriptionsTableReady = true;
}

async function ensureAccessRequestsTable() {
  if (tableReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS access_requests (
      request_id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(120),
      plan VARCHAR(80) NOT NULL,
      price VARCHAR(40) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'requested',
      source VARCHAR(80) NOT NULL DEFAULT 'landing_page',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_access_requests_email_created
    ON access_requests (email, created_at DESC)
  `);

  tableReady = true;
}

// ---------------------------------------------------------------------------
// PayPal helpers — token, subscription lookup, webhook verification
// ---------------------------------------------------------------------------

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal credentials are not configured.");
  }
  // Reuse the cached token until 60s before expiry.
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const basic = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal OAuth failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (Number(data.expires_in) || 0) * 1000;
  return cachedToken;
}

async function fetchPayPalSubscription(subscriptionId) {
  const token = await getPayPalAccessToken();
  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal subscription fetch failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function verifyPayPalWebhookSignature(req) {
  if (!PAYPAL_WEBHOOK_ID) {
    throw new Error("PAYPAL_WEBHOOK_ID is not configured.");
  }
  const token = await getPayPalAccessToken();
  const verifyBody = {
    auth_algo: req.headers["paypal-auth-algo"],
    cert_url: req.headers["paypal-cert-url"],
    transmission_id: req.headers["paypal-transmission-id"],
    transmission_sig: req.headers["paypal-transmission-sig"],
    transmission_time: req.headers["paypal-transmission-time"],
    webhook_id: PAYPAL_WEBHOOK_ID,
    webhook_event: req.body
  };
  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(verifyBody)
    }
  );
  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}

async function upsertSubscription(sub, emailHint) {
  const periodEnd = sub.billing_info?.next_billing_time
    ? new Date(sub.billing_info.next_billing_time)
    : null;
  const email =
    sub.subscriber?.email_address || emailHint || "";
  const customerId =
    sub.subscriber?.payer_id || sub.subscriber?.merchant_id || "";

  await db.query(
    `
      INSERT INTO subscriptions
        (subscription_id, customer_id, email, plan, status, current_period_end, raw, provider, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'paypal', CURRENT_TIMESTAMP)
      ON CONFLICT (subscription_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        email = COALESCE(NULLIF(EXCLUDED.email, ''), subscriptions.email),
        raw = EXCLUDED.raw,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      sub.id,
      customerId,
      normalizeEmail(email),
      "War Room Pro",
      String(sub.status || "UNKNOWN"),
      periodEnd,
      sub
    ]
  );
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Access-request endpoint (educators / investors / pre-launch interest)
router.post("/access-request", requestLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim().slice(0, 120);
    const plan = String(req.body.plan || "").trim();
    const price = String(req.body.price || "").trim();

    if (!isGmail(email)) {
      return res.status(400).json({ error: "Use a Gmail address to request access." });
    }

    if (!PLAN_ALLOWLIST.has(plan)) {
      return res.status(400).json({ error: "Choose a valid LoneStar AI plan." });
    }

    if (!price || price.length > 40) {
      return res.status(400).json({ error: "Plan price is required." });
    }

    await ensureAccessRequestsTable();

    const result = await db.query(
      `
        INSERT INTO access_requests (email, name, plan, price, metadata)
        VALUES ($1, NULLIF($2, ''), $3, $4, $5)
        RETURNING request_id, email, plan, price, status, created_at
      `,
      [
        email,
        name,
        plan,
        price,
        {
          paymentMode: "secure_provider_pending",
          storesCardData: false
        }
      ]
    );

    return res.status(201).json({
      ok: true,
      request: result.rows[0],
      message: "Access request saved. No card data was collected or stored."
    });
  } catch (error) {
    console.error("[billing] access request failed:", error);
    return res.status(500).json({
      error: "Unable to save access request right now."
    });
  }
});

// Frontend boot-config — what the page needs to render the PayPal button.
// Client ID and plan ID are non-secret and safe to expose.
router.get("/paypal/config", (_req, res) => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_PLAN_ID) {
    return res.status(503).json({
      error: "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_PLAN_ID_WAR_ROOM_PRO."
    });
  }
  res.json({
    clientId: PAYPAL_CLIENT_ID,
    planId: PAYPAL_PLAN_ID,
    mode: PAYPAL_MODE
  });
});

// Called by the frontend after the PayPal Smart Button reports onApprove.
// We re-fetch the subscription from PayPal (don't trust the client) and
// write it to the database.
router.post("/paypal/subscription-approved", requestLimiter, async (req, res) => {
  const subscriptionId = String(req.body.subscriptionID || req.body.subscription_id || "").trim();
  if (!subscriptionId) {
    return res.status(400).json({ error: "Missing subscriptionID." });
  }

  try {
    const sub = await fetchPayPalSubscription(subscriptionId);
    await ensureSubscriptionsTable();
    await upsertSubscription(sub);
    return res.json({
      ok: true,
      status: sub.status,
      subscriptionId: sub.id
    });
  } catch (error) {
    console.error("[billing] paypal subscription verify failed:", error);
    return res.status(500).json({
      error: "Unable to verify subscription. Please contact support."
    });
  }
});

// PayPal webhook — receives subscription lifecycle events. Verified against
// PayPal's verification endpoint using the configured webhook id.
router.post("/paypal/webhook", async (req, res) => {
  if (!PAYPAL_WEBHOOK_ID) {
    return res.status(503).send("Webhook not configured");
  }

  try {
    const ok = await verifyPayPalWebhookSignature(req);
    if (!ok) {
      console.warn("[billing] paypal webhook signature verification failed");
      return res.status(400).send("Invalid signature");
    }

    const event = req.body || {};
    const eventType = String(event.event_type || "");

    await ensureSubscriptionsTable();

    if (
      eventType === "BILLING.SUBSCRIPTION.CREATED" ||
      eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
      eventType === "BILLING.SUBSCRIPTION.UPDATED" ||
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED" ||
      eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
      eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED"
    ) {
      const subId =
        event.resource?.id ||
        event.resource?.billing_agreement_id ||
        event.resource?.subscription_id;
      if (subId) {
        try {
          const sub = await fetchPayPalSubscription(subId);
          await upsertSubscription(sub);
        } catch (err) {
          console.error(
            "[billing] paypal webhook subscription fetch failed:",
            err.message
          );
        }
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[billing] paypal webhook handler failed:", error);
    return res.status(500).send("Webhook handler error");
  }
});

module.exports = router;

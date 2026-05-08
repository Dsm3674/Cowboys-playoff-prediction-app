const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../databases");

const router = express.Router();

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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isGmail(email) {
  return /^[^@\s]+@gmail\.com$/i.test(email);
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
      return res.status(400).json({ error: "Choose a valid Cowboys IQ plan." });
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

module.exports = router;

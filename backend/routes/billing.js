const express = require("express");
const rateLimit = require("express-rate-limit");
const fetch = require("node-fetch");
const db = require("../databases");

const router = express.Router();

// ---------------------------------------------------------------------------
// Email notifications via Resend
// When a new access request lands, fire-and-forget an email to the team so
// they can follow up manually. Falls back silently if Resend isn't configured.
// ---------------------------------------------------------------------------
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const NOTIFICATION_EMAIL_TO =
  process.env.NOTIFICATION_EMAIL_TO || "divyanshusomasekhar1@gmail.com";
const NOTIFICATION_EMAIL_FROM =
  process.env.NOTIFICATION_EMAIL_FROM || "LoneStar AI <onboarding@resend.dev>";

async function notifyAccessRequest(record) {
  if (!RESEND_API_KEY) return; // Not configured — skip silently.

  const subject = `[LoneStar AI] New ${record.plan} from ${record.email}`;
  const lines = [
    `Plan:    ${record.plan}`,
    `Email:   ${record.email}`,
    `Name:    ${record.name || "(not provided)"}`,
    `Price:   ${record.price}`,
    `When:    ${record.created_at || new Date().toISOString()}`,
    `ID:      ${record.request_id || "(unknown)"}`
  ];
  const text = lines.join("\n");
  const html =
    `<div style="font-family: -apple-system, system-ui, sans-serif; font-size: 14px; line-height: 1.6;">` +
    `<h2 style="margin: 0 0 16px;">New access request — ${escapeHtml(record.plan)}</h2>` +
    `<table style="border-collapse: collapse;">` +
    lines
      .map((line) => {
        const idx = line.indexOf(":");
        const label = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        return `<tr><td style="padding: 4px 16px 4px 0; color: #666; vertical-align: top;">${escapeHtml(label)}</td><td style="padding: 4px 0;"><strong>${escapeHtml(value)}</strong></td></tr>`;
      })
      .join("") +
    `</table>` +
    `<p style="margin-top: 20px;"><a href="mailto:${encodeURIComponent(record.email)}">Reply to ${escapeHtml(record.email)}</a></p>` +
    `</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: NOTIFICATION_EMAIL_FROM,
        to: [NOTIFICATION_EMAIL_TO],
        reply_to: record.email,
        subject,
        text,
        html
      })
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[billing] resend send failed:", res.status, body);
    }
  } catch (err) {
    console.error("[billing] resend send threw:", err.message);
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Access-request endpoint only. Payment provider integration is intentionally
// not wired up yet — the War Room Pro flow is a waitlist (mailto link) until
// we're ready to take subscriptions.
// ---------------------------------------------------------------------------

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
          paymentMode: "waitlist",
          storesCardData: false
        }
      ]
    );

    const saved = result.rows[0];

    // Fire-and-forget email notification — don't block the response on it.
    notifyAccessRequest({
      ...saved,
      name: name || null
    }).catch((err) => {
      console.error("[billing] notifyAccessRequest unhandled:", err.message);
    });

    return res.status(201).json({
      ok: true,
      request: saved,
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

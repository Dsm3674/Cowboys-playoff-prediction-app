"use strict";

process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";
process.env.EMAIL_OTP_SECRET = "test-email-secret-that-is-long-enough";

jest.mock("../databases", () => ({ query: jest.fn() }));

const express = require("express");
const request = require("supertest");
const db = require("../databases");
const router = require("../routes/auth");
const { verifySessionToken } = require("../middleware/sessionAuth");

const app = express();
app.use(express.json());
app.use("/api/auth", router);

describe("Gmail account authentication", () => {
  const accounts = new Map();

  beforeEach(() => {
    accounts.clear();
    db.query.mockReset();
    db.query.mockImplementation(async (sql, params = []) => {
      const text = String(sql).replace(/\s+/g, " ").trim();
      if (text.startsWith("CREATE TABLE") || text.startsWith("ALTER TABLE")) {
        return { rows: [] };
      }
      if (text.startsWith("SELECT 1 FROM users")) {
        return { rows: accounts.has(params[0]) ? [{ exists: 1 }] : [] };
      }
      if (text.startsWith("INSERT INTO users")) {
        if (accounts.has(params[0])) return { rows: [] };
        accounts.set(params[0], params[1]);
        return { rows: [{ user_id: 1 }] };
      }
      if (text.startsWith("SELECT password_hash FROM users")) {
        const passwordHash = accounts.get(params[0]);
        return { rows: passwordHash ? [{ password_hash: passwordHash }] : [] };
      }
      if (text.startsWith("UPDATE users SET password_hash")) {
        if (!accounts.has(params[1])) return { rows: [] };
        accounts.set(params[1], params[0]);
        return { rows: [{ user_id: 1 }] };
      }
      throw new Error(`Unexpected SQL in test: ${text}`);
    });
  });

  test("stores a password hash and rejects the wrong password", async () => {
    const started = await request(app)
      .post("/api/auth/2fa/start")
      .send({ email: "fan@gmail.com", password: "correct horse" });

    expect(started.status).toBe(200);
    expect(started.body.devCode).toMatch(/^\d{6}$/);

    const verified = await request(app)
      .post("/api/auth/2fa/verify")
      .send({ challengeId: started.body.challengeId, code: started.body.devCode });

    expect(verified.status).toBe(200);
    expect(verifySessionToken(verified.body.sessionToken)).toMatchObject({
      sub: "fan@gmail.com"
    });
    expect(accounts.get("fan@gmail.com")).toMatch(/^scrypt\$/);
    expect(accounts.get("fan@gmail.com")).not.toContain("correct horse");

    const wrong = await request(app)
      .post("/api/auth/session")
      .send({ email: "fan@gmail.com", password: "wrong password" });
    expect(wrong.status).toBe(401);

    const correct = await request(app)
      .post("/api/auth/session")
      .send({ email: "fan@gmail.com", password: "correct horse" });
    expect(correct.status).toBe(200);
    expect(verifySessionToken(correct.body.sessionToken)).toMatchObject({
      sub: "fan@gmail.com"
    });
  });

  test("retires the legacy OTP bypass", async () => {
    const response = await request(app)
      .post("/api/auth/verify-otp")
      .send({ challengeId: Buffer.from("owner@gmail.com").toString("base64url"), code: "anything" });
    expect(response.status).toBe(410);
  });
});

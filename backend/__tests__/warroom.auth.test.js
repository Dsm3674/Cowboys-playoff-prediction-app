"use strict";

process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";

jest.mock("../databases", () => ({ query: jest.fn() }));

const express = require("express");
const request = require("supertest");
const router = require("../routes/warroom");
const { createSessionToken } = require("../middleware/sessionAuth");

const app = express();
app.use(express.json());
app.use("/api/warroom", router);

describe("War Room authentication", () => {
  test("does not trust a caller-supplied owner email", async () => {
    const response = await request(app)
      .get("/api/warroom/status")
      .set("X-LoneStar-User", "divyanshusomasekhar1@gmail.com");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ signedIn: false, pro: false, email: null });
  });

  test("accepts the identity in a valid signed session", async () => {
    const token = createSessionToken("divyanshusomasekhar1@gmail.com");
    const response = await request(app)
      .get("/api/warroom/status")
      .set("X-LoneStar-Session", token);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      signedIn: true,
      pro: true,
      email: "divyanshusomasekhar1@gmail.com"
    });
  });
});

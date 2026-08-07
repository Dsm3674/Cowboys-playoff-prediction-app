"use strict";

process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";

const {
  createSessionToken,
  verifySessionToken
} = require("../middleware/sessionAuth");

describe("signed sessions", () => {
  test("round-trips an authenticated identity", () => {
    const token = createSessionToken("Fan@gmail.com");
    expect(verifySessionToken(token)).toMatchObject({ sub: "fan@gmail.com" });
  });

  test("rejects a tampered identity", () => {
    const token = createSessionToken("fan@gmail.com");
    const [payload, signature] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.sub = "divyanshusomasekhar1@gmail.com";
    const tampered = `${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${signature}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });
});

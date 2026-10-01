"use strict";

describe("Prediction ownership migration", () => {
  test("a failed first attempt is retried on the next call", async () => {
    jest.resetModules();
    let fail = true;
    const query = jest.fn(async () => {
      if (fail) throw new Error("database briefly down");
      return { rows: [] };
    });
    jest.doMock("../databases", () => ({ query }));
    const Prediction = require("../predictions");

    await expect(Prediction.ensureOwnershipColumns()).rejects.toThrow("briefly down");
    fail = false;
    await expect(Prediction.ensureOwnershipColumns()).resolves.toBeUndefined();
    expect(query.mock.calls.length).toBe(4); // 1 failed + 3 successful statements
    jest.dontMock("../databases");
  });
});

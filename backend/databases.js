"use strict";

const { Pool } = require("pg");
require("dotenv").config();

let pool = null;
let shutdownRegistered = false;

function isTestEnv() {
  return process.env.NODE_ENV === "test";
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function getSslConfig() {
  if (process.env.PGSSLMODE === "disable") return {};
  return { ssl: { rejectUnauthorized: false } };
}

function getConnectionString() {
  return process.env.DATABASE_URL || "";
}

function getPoolConfig() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    if (isTestEnv()) return null;
    throw new Error("DATABASE_URL is not set. Refusing to start with a synthetic or stub database connection.");
  }

  const max = Number(process.env.PG_POOL_MAX || 20);
  const idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS || 30000);
  const connectionTimeoutMillis = Number(process.env.PG_CONNECT_TIMEOUT_MS || 2000);
  const allowExitOnIdle = isTruthy(process.env.PG_ALLOW_EXIT_ON_IDLE || "false");

  return {
    connectionString,
    ...getSslConfig(),
    max: Number.isFinite(max) ? max : 20,
    idleTimeoutMillis: Number.isFinite(idleTimeoutMillis) ? idleTimeoutMillis : 30000,
    connectionTimeoutMillis: Number.isFinite(connectionTimeoutMillis) ? connectionTimeoutMillis : 2000,
    allowExitOnIdle
  };
}

function attachPoolEvents(instance) {
  if (!instance || typeof instance.on !== "function") return;

  instance.on("connect", () => {
    console.log("Database connected successfully");
  });

  instance.on("acquire", () => {
    if (process.env.DB_DEBUG === "true") {
      console.log("Database client acquired");
    }
  });

  instance.on("release", () => {
    if (process.env.DB_DEBUG === "true") {
      console.log("Database client released");
    }
  });

  instance.on("remove", () => {
    if (process.env.DB_DEBUG === "true") {
      console.log("Database client removed");
    }
  });

  instance.on("error", (err) => {
    console.error("Unexpected database error:", err);
  });
}

function createPool() {
  const config = getPoolConfig();
  if (!config) return null;
  const instance = new Pool(config);
  attachPoolEvents(instance);
  return instance;
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

async function query(text, params = []) {
  const activePool = getPool();

  if (!activePool) {
    throw new Error("Database access attempted in test mode without an injected or mocked pool.");
  }

  return activePool.query(text, params);
}

async function connect() {
  const activePool = getPool();

  if (!activePool) {
    throw new Error("Database connect attempted in test mode without an injected or mocked pool.");
  }

  return activePool.connect();
}

async function withClient(fn) {
  if (typeof fn !== "function") {
    throw new Error("withClient requires a callback function.");
  }

  const client = await connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function transaction(fn) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function ping() {
  const result = await query("SELECT 1 AS ok");
  return result.rows?.[0]?.ok === 1;
}

async function healthcheck() {
  try {
    const startedAt = Date.now();
    const ok = await ping();
    const elapsedMs = Date.now() - startedAt;

    return {
      ok,
      elapsedMs,
      configured: Boolean(getConnectionString()),
      environment: process.env.NODE_ENV || "development"
    };
  } catch (error) {
    return {
      ok: false,
      elapsedMs: null,
      configured: Boolean(getConnectionString()),
      environment: process.env.NODE_ENV || "development",
      error: error.message
    };
  }
}

async function end() {
  const activePool = pool;
  if (!activePool) return;
  pool = null;
  await activePool.end();
}

async function shutdown(signal = "unknown") {
  try {
    if (process.env.DB_DEBUG === "true") {
      console.log(`Database shutdown requested by ${signal}`);
    }
    await end();
    if (process.env.DB_DEBUG === "true") {
      console.log("Database pool closed");
    }
  } catch (error) {
    console.error("Failed to close database pool cleanly:", error);
  }
}

function registerShutdownHandlers() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  if (isTestEnv()) return;

  process.on("SIGTERM", async () => {
    await shutdown("SIGTERM");
  });

  process.on("SIGINT", async () => {
    await shutdown("SIGINT");
  });

  process.on("beforeExit", async () => {
    await shutdown("beforeExit");
  });
}

registerShutdownHandlers();

module.exports = {
  query,
  connect,
  withClient,
  transaction,
  ping,
  healthcheck,
  end,
  getPool
};

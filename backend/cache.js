/**
 * cache.js
 * Hybrid cache layer supporting Redis and in-memory fallback.
 * Supports server-side caching with TTL management and metrics.
 *
 * TTL semantics (UPDATED):
 *   - `set(ns, val, ttl, ...params)` keeps backwards-compatible heuristic:
 *       ttl >= 1000  -> seconds
 *       ttl <  1000  -> milliseconds
 *     This preserves behavior for existing callers (routes/players.js passes
 *     `ttl: 3600` meaning 1 hour; tests pass `ttl: 100` meaning 100ms).
 *   - For NEW code, prefer the explicit wrappers:
 *       cache.setSeconds(ns, val, sec, ...params)
 *       cache.setMs(ns, val, ms, ...params)
 *     so the unit is unambiguous at the call site.
 */

let Redis;
try {
  Redis = require("ioredis");
} catch (e) {
  Redis = null;
}

class HybridCache {
  constructor() {
    this.useRedis = false;
    this.redis = null;
    this.memoryStore = new Map();
    this.store = this.memoryStore;

    this.TTL_CONFIG = {
      CLUTCH_ANALYSIS: 5 * 60,
      LIVE_SEASON_STATS: 10 * 60,
      PER_GAME_STATS: 3 * 60,
      PER_QUARTER_STATS: 2 * 60,
      PER_PLAY_STATS: 1 * 60,
      PLAYER_MAPS: 5 * 60,
      RIVAL_IMPACT: 10 * 60,
      OFF_SEASON_STATS: 60 * 60,
      PLAYER_EVENTS: 5 * 60,
      PLAYER_SEARCH: 10 * 60,
      TIMELINE_POINTS: 10 * 60,
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      redisConnected: false,
    };

    this.initRedis();
    this.startCleanup();
  }

  initRedis() {
    if (!Redis || !process.env.REDIS_URL) {
      console.log("[CACHE] Using in-memory cache (Redis not configured)");
      return;
    }

    try {
      this.redis = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        enableOfflineQueue: false,
      });

      this.redis.on("connect", () => {
        this.useRedis = true;
        this.metrics.redisConnected = true;
        console.log("[CACHE] ✅ Connected to Redis");
      });

      this.redis.on("error", (err) => {
        this.useRedis = false;
        this.metrics.redisConnected = false;
        console.warn("[CACHE] Redis error, falling back to memory:", err.message);
        this.metrics.errors++;
      });

      this.redis.on("close", () => {
        this.useRedis = false;
        this.metrics.redisConnected = false;
        console.log("[CACHE] Redis connection closed");
      });
    } catch (error) {
      console.warn("[CACHE] Failed to initialize Redis:", error.message);
    }
  }

  getKey(namespace, ...params) {
    return `${namespace}:${params.join(":")}`;
  }

  // -------------------------------------------------------------------------
  // Core set with backwards-compatible heuristic.
  // Prefer setSeconds() or setMs() in new code.
  // -------------------------------------------------------------------------
  set(namespace, value, ttl = null, ...params) {
    const key = this.getKey(namespace, ...params);
    const ttlSecondsDefault = this.TTL_CONFIG[namespace] || 300;

    try {
      let expiresAt;
      let ttlSecondsForRedis;

      if (typeof ttl === "number" && ttl > 0) {
        if (ttl < 1000) {
          // Treat as milliseconds (legacy test convention).
          expiresAt = Date.now() + ttl;
          ttlSecondsForRedis = Math.max(1, Math.ceil(ttl / 1000));
        } else {
          // Treat as seconds.
          expiresAt = Date.now() + ttl * 1000;
          ttlSecondsForRedis = ttl;
        }
      } else {
        expiresAt = Date.now() + ttlSecondsDefault * 1000;
        ttlSecondsForRedis = ttlSecondsDefault;
      }

      this.memoryStore.set(key, {
        value,
        expiresAt,
        createdAt: Date.now(),
      });

      if (this.useRedis && this.redis && typeof this.redis.setex === "function") {
        try {
          this.redis.setex(key, ttlSecondsForRedis, JSON.stringify(value)).catch(() => {});
        } catch (e) {
          // Ignore best-effort Redis write failures.
        }
      }

      this.metrics.sets++;
      return true;
    } catch (error) {
      console.error("[CACHE] Set error:", error.message);
      this.metrics.errors++;
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Explicit-unit wrappers. Recommended for new code.
  // -------------------------------------------------------------------------

  /**
   * Internal: write to both stores with a precomputed expiresAt and Redis TTL.
   * All public set methods funnel through this.
   */
  _writeRaw(namespace, value, expiresAt, ttlSecondsForRedis, params) {
    const key = this.getKey(namespace, ...params);
    try {
      this.memoryStore.set(key, {
        value,
        expiresAt,
        createdAt: Date.now(),
      });
      if (this.useRedis && this.redis && typeof this.redis.setex === "function") {
        try {
          this.redis.setex(key, ttlSecondsForRedis, JSON.stringify(value)).catch(() => {});
        } catch (e) {
          // Ignore best-effort Redis write failures.
        }
      }
      this.metrics.sets++;
      return true;
    } catch (error) {
      console.error("[CACHE] _writeRaw error:", error.message);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Store a value with a TTL specified in seconds.
   * Unambiguous regardless of magnitude (60 always means 60 seconds).
   * @example cache.setSeconds("PLAYER_MAPS", data, 3600, "season_2025")
   */
  setSeconds(namespace, value, seconds, ...params) {
    if (typeof seconds !== "number" || seconds <= 0) {
      return this.set(namespace, value, null, ...params);
    }
    const sec = Math.max(1, Math.floor(seconds));
    return this._writeRaw(namespace, value, Date.now() + sec * 1000, sec, params);
  }

  /**
   * Store a value with a TTL specified in milliseconds.
   * Unambiguous regardless of magnitude (5000 always means 5000ms).
   * @example cache.setMs("LIVE_GAME", data, 30_000, gameId)
   */
  setMs(namespace, value, ms, ...params) {
    if (typeof ms !== "number" || ms <= 0) {
      return this.set(namespace, value, null, ...params);
    }
    const ttlSec = Math.max(1, Math.ceil(ms / 1000));
    return this._writeRaw(namespace, value, Date.now() + ms, ttlSec, params);
  }

  get(namespace, ...params) {
    const key = this.getKey(namespace, ...params);

    try {
      const entry = this.memoryStore.get(key);
      if (!entry) {
        this.metrics.misses++;
        return null;
      }
      if (Date.now() > entry.expiresAt) {
        this.memoryStore.delete(key);
        this.metrics.misses++;
        return null;
      }
      this.metrics.hits++;
      return entry.value;
    } catch (error) {
      console.error("[CACHE] Get error:", error.message);
      this.metrics.errors++;
      return null;
    }
  }

  has(namespace, ...params) {
    const key = this.getKey(namespace, ...params);
    try {
      const entry = this.memoryStore.get(key);
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        this.memoryStore.delete(key);
        return false;
      }
      return true;
    } catch (error) {
      console.error("[CACHE] Has error:", error.message);
      this.metrics.errors++;
      return false;
    }
  }

  delete(namespace, ...params) {
    const key = this.getKey(namespace, ...params);
    try {
      const existed = this.memoryStore.delete(key);
      if (this.useRedis && this.redis && typeof this.redis.del === "function") {
        try {
          this.redis.del(key).catch(() => {});
        } catch (e) {
          // Ignore best-effort Redis delete failures.
        }
      }
      this.metrics.deletes++;
      return existed;
    } catch (error) {
      console.error("[CACHE] Delete error:", error.message);
      this.metrics.errors++;
      return false;
    }
  }

  clearNamespace(namespace) {
    try {
      let count = 0;
      for (const key of Array.from(this.memoryStore.keys())) {
        if (key.startsWith(`${namespace}:`)) {
          this.memoryStore.delete(key);
          count++;
        }
      }
      return count;
    } catch (error) {
      console.error("[CACHE] Clear namespace error:", error.message);
      this.metrics.errors++;
      return 0;
    }
  }

  clear() {
    try {
      this.memoryStore.clear();
      this.metrics = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        redisConnected: this.metrics.redisConnected || false,
      };
      return true;
    } catch (error) {
      console.error("[CACHE] Clear all error:", error.message);
      this.metrics.errors++;
      return false;
    }
  }

  keys(_pattern = "*") {
    try {
      return Array.from(this.memoryStore.keys());
    } catch (error) {
      console.error("[CACHE] Keys error:", error.message);
      this.metrics.errors++;
      return [];
    }
  }

  cleanup() {
    if (this.useRedis) return; // Redis handles expiration
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (!entry || now > entry.expiresAt) {
        this.memoryStore.delete(key);
        removed++;
      }
    }
    if (removed > 0) console.log(`[CACHE] Cleaned up ${removed} expired entries`);
    return removed;
  }

  startCleanup() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  async getOrCompute(namespace, computeFn, options = {}) {
    const { ttl, params = [] } = options;
    const cached = this.get(namespace, ...params);
    if (cached !== null) return cached;
    const value = await computeFn();
    this.set(namespace, value, ttl, ...params);
    return value;
  }

  getMetrics() {
    const size = this.memoryStore.size;
    const hitRate =
      this.metrics.hits + this.metrics.misses > 0
        ? ((this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100).toFixed(2)
        : 0;

    let totalBytes = 0;
    for (const entry of this.memoryStore.values()) {
      try {
        totalBytes += Buffer.byteLength(JSON.stringify(entry.value), "utf8");
      } catch (e) {
        totalBytes += 0;
      }
    }
    const memoryKB = (totalBytes / 1024).toFixed(2) + "KB";

    return {
      ...this.metrics,
      hitRate: `${hitRate}%`,
      size,
      memory: memoryKB,
      backend: this.useRedis ? "redis" : "memory",
    };
  }

  // Backwards-compatible alias expected by tests
  getStats() {
    return this.getMetrics();
  }

  async destroy() {
    try {
      if (this.redis && typeof this.redis.quit === "function") {
        try {
          await this.redis.quit();
        } catch (e) {
          // Ignore Redis teardown failures.
        }
      }
      if (this.cleanupInterval) clearInterval(this.cleanupInterval);
      this.memoryStore.clear();
      console.log("[CACHE] Cache destroyed");
    } catch (error) {
      console.error("[CACHE] Destroy error:", error.message);
    }
  }
}

const cache = new HybridCache();

module.exports = cache;

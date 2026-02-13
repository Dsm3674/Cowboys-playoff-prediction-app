/**
 * cache.js
 * Hybrid cache layer supporting Redis and in-memory fallback
 * Supports server-side caching with TTL management and metrics
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

    this.TTL_CONFIG = {
      CLUTCH_ANALYSIS: 5 * 60,           // 5 minutes
      LIVE_SEASON_STATS: 10 * 60,        // 10 minutes
      PER_GAME_STATS: 3 * 60,            // 3 minutes
      PER_QUARTER_STATS: 2 * 60,         // 2 minutes
      PER_PLAY_STATS: 1 * 60,            // 1 minute
      PLAYER_MAPS: 5 * 60,               // 5 minutes
      RIVAL_IMPACT: 10 * 60,             // 10 minutes
      OFF_SEASON_STATS: 60 * 60,         // 60 minutes
      PLAYER_EVENTS: 5 * 60,             // 5 minutes
      PLAYER_SEARCH: 10 * 60,            // 10 minutes
      TIMELINE_POINTS: 10 * 60,          // 10 minutes
    };

    // Metrics
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

  /**
   * Initialize Redis connection if available
   */
  initRedis() {
    if (!Redis || !process.env.REDIS_URL) {
      console.log("[CACHE] Using in-memory cache (Redis not configured)");
      return;
    }

    try {
      this.redis = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
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

  /**
   * Generate cache key
   */
  getKey(namespace, ...params) {
    return `cache:${namespace}:${params.join(":")}`;
  }

  /**
   * Set value in cache
   */
  async set(namespace, value, ttl = null, ...params) {
    const key = this.getKey(namespace, ...params);
    const ttlSeconds = ttl || this.TTL_CONFIG[namespace] || 300;

    try {
      const valueStr = JSON.stringify(value);

      if (this.useRedis && this.redis) {
        await this.redis.setex(key, ttlSeconds, valueStr);
      } else {
        this.memoryStore.set(key, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
      }

      this.metrics.sets++;
    } catch (error) {
      console.error("[CACHE] Set error:", error.message);
      this.metrics.errors++;
    }
  }

  /**
   * Get value from cache
   */
  async get(namespace, ...params) {
    const key = this.getKey(namespace, ...params);

    try {
      if (this.useRedis && this.redis) {
        const value = await this.redis.get(key);
        if (value) {
          this.metrics.hits++;
          return JSON.parse(value);
        }
        this.metrics.misses++;
        return null;
      } else {
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
      }
    } catch (error) {
      console.error("[CACHE] Get error:", error.message);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Check if key exists
   */
  async has(namespace, ...params) {
    const key = this.getKey(namespace, ...params);

    try {
      if (this.useRedis && this.redis) {
        const exists = await this.redis.exists(key);
        return exists === 1;
      } else {
        const entry = this.memoryStore.get(key);
        if (!entry) return false;
        if (Date.now() > entry.expiresAt) {
          this.memoryStore.delete(key);
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error("[CACHE] Has error:", error.message);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete key
   */
  async delete(namespace, ...params) {
    const key = this.getKey(namespace, ...params);

    try {
      if (this.useRedis && this.redis) {
        await this.redis.del(key);
      } else {
        this.memoryStore.delete(key);
      }
      this.metrics.deletes++;
    } catch (error) {
      console.error("[CACHE] Delete error:", error.message);
      this.metrics.errors++;
    }
  }

  /**
   * Clear namespace
   */
  async clearNamespace(namespace) {
    try {
      if (this.useRedis && this.redis) {
        const pattern = `cache:${namespace}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return keys.length;
      } else {
        let count = 0;
        for (const key of this.memoryStore.keys()) {
          if (key.startsWith(`cache:${namespace}:`)) {
            this.memoryStore.delete(key);
            count++;
          }
        }
        return count;
      }
    } catch (error) {
      console.error("[CACHE] Clear namespace error:", error.message);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.flushdb();
      } else {
        this.memoryStore.clear();
      }
    } catch (error) {
      console.error("[CACHE] Clear all error:", error.message);
      this.metrics.errors++;
    }
  }

  /**
   * Get all keys (for inspection)
   */
  async keys(pattern = "*") {
    try {
      if (this.useRedis && this.redis) {
        return await this.redis.keys(`cache:${pattern}`);
      } else {
        return Array.from(this.memoryStore.keys()).filter((k) =>
          k.startsWith("cache:")
        );
      }
    } catch (error) {
      console.error("[CACHE] Keys error:", error.message);
      this.metrics.errors++;
      return [];
    }
  }

  /**
   * Cleanup expired entries (memory-only)
   */
  cleanup() {
    if (this.useRedis) return; // Redis handles expiration

    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (now > entry.expiresAt) {
        this.memoryStore.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[CACHE] Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Get cache or compute value
   */
  async getOrCompute(namespace, computeFn, options = {}) {
    const { ttl, params = [] } = options;

    const cached = await this.get(namespace, ...params);
    if (cached !== null) {
      return cached;
    }

    const value = await computeFn();
    await this.set(namespace, value, ttl, ...params);
    return value;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    let size = 0;
    if (this.useRedis) {
      size = this.memoryStore.size; // placeholder
    } else {
      size = this.memoryStore.size;
    }

    const hitRate =
      this.metrics.hits + this.metrics.misses > 0
        ? (
            (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) *
            100
          ).toFixed(2)
        : 0;

    return {
      ...this.metrics,
      hitRate: `${hitRate}%`,
      size,
      backend: this.useRedis ? "redis" : "memory",
    };
  }

  /**
   * Destroy cache (cleanup)
   */
  async destroy() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      this.memoryStore.clear();
      console.log("[CACHE] Cache destroyed");
    } catch (error) {
      console.error("[CACHE] Destroy error:", error.message);
    }
  }
}

// Singleton instance
const cache = new HybridCache();

module.exports = cache;

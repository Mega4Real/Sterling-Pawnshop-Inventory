/**
 * lib/rate-limit.ts
 *
 * In-memory rate limiter using a sliding window approach.
 * Suitable for single-instance serverless deployments (Vercel).
 *
 * For multi-instance or persistent limiting, replace with
 * a Redis-backed store (e.g., @upstash/ratelimit).
 */

/** Tracks request timestamps for a single key */
interface RateLimitEntry {
  /** Timestamps (ms) of requests within the current window */
  timestamps: number[];
}

/** Configuration for a rate limiter instance */
interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/** Result of a rate limit check */
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Milliseconds until the window resets (for retry-after header) */
  retryAfterMs: number;
}

/** In-memory store: key → entry */
const stores = new Map<string, Map<string, RateLimitEntry>>();

/** Interval ID for the periodic cleanup timer */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Performs periodic cleanup of expired entries across all stores.
 * Runs every 60 seconds to prevent unbounded memory growth.
 */
function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [storeName, store] of Array.from(stores)) {
      for (const [key, entry] of Array.from(store)) {
        // Remove entries with no recent timestamps
        entry.timestamps = entry.timestamps.filter((t) => now - t < 600_000);
        if (entry.timestamps.length === 0) {
          store.delete(key);
        }
      }
      if (store.size === 0) {
        stores.delete(storeName);
      }
    }
  }, 60_000);

  // Allow Node to exit even if the interval is still running
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

/**
 * Creates a named rate limiter with the given configuration.
 *
 * @param name   - Unique name for this limiter (e.g., 'sms', 'login')
 * @param config - Rate limiting rules: maxRequests per windowMs
 *
 * @returns A `check(key)` function that returns whether the request is allowed
 *
 * @example
 * ```ts
 * const loginLimiter = createRateLimiter('login', { maxRequests: 5, windowMs: 15 * 60 * 1000 });
 * const result = loginLimiter.check(clientIp);
 * if (!result.allowed) {
 *   return new Response('Too many attempts', { status: 429 });
 * }
 * ```
 */
export function createRateLimiter(name: string, config: RateLimitConfig) {
  // Get or create the store for this limiter
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  // Start cleanup if not already running
  startCleanup();

  return {
    /**
     * Check if a request from the given key is allowed.
     *
     * @param key - Identifier for the requester (IP, user ID, loan ID, etc.)
     * @returns Whether the request is allowed, remaining quota, and retry-after
     */
    check(key: string): RateLimitResult {
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Get or create entry for this key
      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the current window
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

      // Check if under the limit
      if (entry.timestamps.length < config.maxRequests) {
        entry.timestamps.push(now);
        return {
          allowed: true,
          remaining: config.maxRequests - entry.timestamps.length,
          retryAfterMs: 0,
        };
      }

      // Over limit — calculate when the earliest timestamp will expire
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + config.windowMs - now;

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(retryAfterMs, 0),
      };
    },

    /**
     * Reset the rate limit for a specific key.
     * Useful after a successful login to clear failed attempt history.
     *
     * @param key - The key to reset
     */
    reset(key: string): void {
      store.delete(key);
    },
  };
}

/* ─── Pre-configured limiters ─────────────────────────────────────────── */

/**
 * SMS rate limiter: 3 sends per loan ID per 10 minutes.
 * Prevents accidental or malicious SMS cost abuse.
 */
export const smsPerLoanLimiter = createRateLimiter('sms-per-loan', {
  maxRequests: 3,
  windowMs: 10 * 60 * 1000, // 10 minutes
});

/**
 * Global SMS rate limiter: 15 total sends per 60 minutes.
 * Caps total SMS spend regardless of which loans are being messaged.
 */
export const smsGlobalLimiter = createRateLimiter('sms-global', {
  maxRequests: 15,
  windowMs: 60 * 60 * 1000, // 1 hour
});

/**
 * Login rate limiter: 5 attempts per IP per 15 minutes.
 * Blocks brute-force credential stuffing.
 */
export const loginLimiter = createRateLimiter('login', {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

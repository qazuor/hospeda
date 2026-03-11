/**
 * Account lockout store for brute-force protection.
 * Tracks failed login attempts per email and enforces temporary lockouts.
 * Uses Redis when available, falls back to in-memory Map.
 *
 * Follows the same dual-store pattern as rate-limit.ts.
 *
 * @module auth-lockout
 */

import { apiLogger } from '../utils/logger.js';
import { getRedisClient } from '../utils/redis.js';

/** Lockout entry tracking failed attempts for an email */
interface LockoutEntry {
    readonly count: number;
    readonly firstAttempt: number; // Unix timestamp ms
}

/** Abstract lockout store interface */
interface LockoutStore {
    get(email: string): Promise<LockoutEntry | undefined>;
    set(email: string, entry: LockoutEntry, windowMs: number): Promise<void>;
    delete(email: string): Promise<void>;
    clear(): Promise<void>;
}

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Reads lockout config lazily from env vars.
 * Lazy reading allows tests to set process.env values before the first call.
 */
function getConfig() {
    return {
        maxAttempts: Number(process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS) || 5,
        windowMs: Number(process.env.HOSPEDA_AUTH_LOCKOUT_WINDOW_MS) || 900000
    };
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const memoryStore = new Map<string, LockoutEntry>();

/** Cleanup interval handle (undefined in test env) */
let cleanupInterval: ReturnType<typeof setInterval> | undefined;

/** Interval between cleanup sweeps (5 minutes, same as rate-limit.ts) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Removes expired entries from the in-memory store to prevent memory leaks.
 */
function cleanupExpiredEntries(): void {
    const now = Date.now();
    const { windowMs } = getConfig();
    for (const [key, entry] of memoryStore.entries()) {
        if (now - entry.firstAttempt > windowMs) {
            memoryStore.delete(key);
        }
    }
}

if (process.env.NODE_ENV !== 'test') {
    cleanupInterval = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
    cleanupInterval.unref();
}

const inMemoryStore: LockoutStore = {
    async get(email: string) {
        return memoryStore.get(email);
    },
    async set(email: string, entry: LockoutEntry) {
        memoryStore.set(email, entry);
    },
    async delete(email: string) {
        memoryStore.delete(email);
    },
    async clear() {
        memoryStore.clear();
    }
};

// ─── Redis Store ─────────────────────────────────────────────────────────────

/**
 * Key prefix for lockout counters stored in Redis.
 * Each key holds an integer counter (incremented atomically via INCR).
 * The TTL of the key encodes the remaining window duration.
 */
const REDIS_KEY_PREFIX = 'lockout:';

/**
 * Builds the Redis key for a given lockout subject key.
 */
function redisKey(key: string): string {
    return `${REDIS_KEY_PREFIX}${key}`;
}

/**
 * Redis-backed lockout store.
 *
 * Uses INCR + EXPIRE for atomic counter increments, eliminating the
 * read-modify-write race condition present in a naive GET → JS increment → SET
 * pattern. The get/set interface methods are retained for compatibility with the
 * LockoutStore interface used by the in-memory fallback path, but they are not
 * called for the core increment/check operations when Redis is reachable.
 *
 * TTL encodes the remaining window: when INCR returns 1 (first attempt in the
 * window), EXPIRE is set to windowMs / 1000 seconds. Subsequent INCRs leave the
 * TTL untouched. checkLockout reads the counter with GET and derives retryAfter
 * from the key's remaining TTL via the TTL command.
 */
const createRedisStore = (): LockoutStore & {
    incr(key: string, windowMs: number): Promise<number | undefined>;
    count(key: string): Promise<number | undefined>;
    ttl(key: string): Promise<number>;
} => ({
    /**
     * Atomically increments the attempt counter for a key.
     * Sets the TTL on the first increment so the window is enforced by Redis.
     *
     * @param key - Lockout subject key
     * @param windowMs - Window duration in milliseconds (used to set TTL on first INCR)
     * @returns New counter value, or undefined if Redis is unavailable
     */
    async incr(key: string, windowMs: number): Promise<number | undefined> {
        try {
            const redis = await getRedisClient();
            if (!redis) return undefined;

            const rKey = redisKey(key);
            const newCount = await redis.incr(rKey);

            // Only set expiry on the first increment — subsequent INCRs must
            // not reset the window, which would allow an attacker to keep the
            // window sliding indefinitely.
            if (newCount === 1) {
                const ttlSeconds = Math.ceil(windowMs / 1000);
                await redis.expire(rKey, ttlSeconds);
            }

            return newCount;
        } catch (error) {
            apiLogger.warn(
                { error },
                'Redis unavailable for lockout INCR, falling back to in-memory'
            );
            return undefined;
        }
    },

    /**
     * Reads the current attempt counter for a key without modifying it.
     *
     * @param key - Lockout subject key
     * @returns Current counter value (0 if key does not exist), or undefined if Redis is unavailable
     */
    async count(key: string): Promise<number | undefined> {
        try {
            const redis = await getRedisClient();
            if (!redis) return undefined;

            const value = await redis.get(redisKey(key));
            return value === null ? 0 : Number(value);
        } catch (error) {
            apiLogger.warn(
                { error },
                'Redis unavailable for lockout GET, falling back to in-memory'
            );
            return undefined;
        }
    },

    /**
     * Returns the remaining TTL in seconds for a lockout key.
     * Returns -2 if the key does not exist, -1 if it has no TTL.
     *
     * @param key - Lockout subject key
     */
    async ttl(key: string): Promise<number> {
        try {
            const redis = await getRedisClient();
            if (!redis) return -2;
            return redis.ttl(redisKey(key));
        } catch (error) {
            apiLogger.warn(
                { error },
                'Redis unavailable for lockout TTL, falling back to in-memory'
            );
            return -2;
        }
    },

    // ── LockoutStore interface methods (used by fallback paths only) ──────

    async get(key: string): Promise<LockoutEntry | undefined> {
        try {
            const redis = await getRedisClient();
            if (!redis) return inMemoryStore.get(key);

            const value = await redis.get(redisKey(key));
            if (value === null) return undefined;

            const count = Number(value);
            const remainingTtl = await redis.ttl(redisKey(key));
            // Reconstruct a synthetic LockoutEntry from count and remaining TTL.
            // firstAttempt is approximated from the TTL and the current time.
            // This is only used by the generic checkLockoutByKey path which the
            // optimised Redis path bypasses, so approximate values are acceptable.
            const { windowMs } = getConfig();
            const firstAttempt = Date.now() - (windowMs - remainingTtl * 1000);
            return { count, firstAttempt };
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable for lockout, falling back to in-memory');
            return inMemoryStore.get(key);
        }
    },

    async set(key: string, entry: LockoutEntry, windowMs: number): Promise<void> {
        try {
            const redis = await getRedisClient();
            if (!redis) {
                await inMemoryStore.set(key, entry, windowMs);
                return;
            }

            const ttlSeconds = Math.ceil(windowMs / 1000);
            await redis.set(redisKey(key), String(entry.count), 'EX', ttlSeconds);
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable for lockout, falling back to in-memory');
            await inMemoryStore.set(key, entry, windowMs);
        }
    },

    async delete(key: string): Promise<void> {
        try {
            const redis = await getRedisClient();
            if (!redis) {
                await inMemoryStore.delete(key);
                return;
            }

            await redis.del(redisKey(key));
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable for lockout, falling back to in-memory');
            await inMemoryStore.delete(key);
        }
    },

    async clear(): Promise<void> {
        try {
            const redis = await getRedisClient();
            if (!redis) {
                await inMemoryStore.clear();
                return;
            }

            let cursor = '0';
            do {
                const [nextCursor, keys] = await redis.scan(
                    cursor,
                    'MATCH',
                    `${REDIS_KEY_PREFIX}*`,
                    'COUNT',
                    100
                );
                cursor = nextCursor;
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } while (cursor !== '0');
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable for lockout, falling back to in-memory');
            await inMemoryStore.clear();
        }
    }
});

// ─── Store Selection ─────────────────────────────────────────────────────────

/**
 * Extended Redis store type that exposes atomic INCR/TTL operations
 * in addition to the generic LockoutStore interface.
 */
type RedisLockoutStore = LockoutStore & {
    incr(key: string, windowMs: number): Promise<number | undefined>;
    count(key: string): Promise<number | undefined>;
    ttl(key: string): Promise<number>;
};

/** Active store (lazy-initialized singleton) */
let activeStore: LockoutStore | undefined;

/**
 * Returns the active lockout store, creating it on first call.
 * When HOSPEDA_REDIS_URL is set the Redis store (with atomic INCR) is used;
 * otherwise the in-memory store is used as fallback.
 */
function getStore(): LockoutStore {
    if (!activeStore) {
        const redisUrl = process.env.HOSPEDA_REDIS_URL;
        if (redisUrl) {
            activeStore = createRedisStore();
        } else {
            activeStore = inMemoryStore;
            if (process.env.NODE_ENV === 'production') {
                apiLogger.warn(
                    'Lockout store using in-memory fallback. ' +
                        'Set HOSPEDA_REDIS_URL for multi-instance lockout support.'
                );
            }
        }
    }
    return activeStore;
}

/**
 * Narrows the active store to the Redis store type with atomic operations.
 * Returns undefined when the active store is the in-memory fallback.
 */
function getRedisStore(): RedisLockoutStore | undefined {
    const store = getStore();
    if ('incr' in store && 'count' in store && 'ttl' in store) {
        return store as RedisLockoutStore;
    }
    return undefined;
}

// ─── Core lockout logic (key-based) ──────────────────────────────────────────

/**
 * Custom lockout configuration to override env-derived defaults.
 * Used by endpoints that require different thresholds than sign-in.
 */
export interface LockoutConfig {
    /** Maximum failed attempts before locking out. */
    readonly maxAttempts: number;
    /** Time window in milliseconds during which attempts are counted. */
    readonly windowMs: number;
}

/**
 * Check if an arbitrary lockout key is currently locked out.
 *
 * When Redis is available, uses an atomic GET + TTL read so the check itself
 * never modifies state. Falls back to the in-memory store path otherwise.
 *
 * This is the low-level primitive shared by all lockout-protected endpoints.
 * Callers are responsible for constructing the key and providing the config.
 *
 * @param key - Unique string key identifying the subject (e.g. email, "email:ip")
 * @param config - Lockout thresholds to use for this check
 * @returns locked=true and retryAfter (remaining seconds) if locked, otherwise locked=false
 *
 * @example
 * ```ts
 * const key = `${email}:${ip}`;
 * const { locked, retryAfter } = await checkLockoutByKey({
 *     key,
 *     config: { maxAttempts: 5, windowMs: 900_000 }
 * });
 * ```
 */
export async function checkLockoutByKey({
    key,
    config
}: {
    key: string;
    config: LockoutConfig;
}): Promise<{ locked: boolean; retryAfter: number }> {
    const { maxAttempts } = config;

    // ── Redis path: use atomic count + TTL reads ──────────────────────────
    const redisStore = getRedisStore();
    if (redisStore) {
        const currentCount = await redisStore.count(key);

        // count() returns undefined only when Redis is unavailable; fall through
        // to the in-memory path in that case.
        if (currentCount !== undefined) {
            if (currentCount < maxAttempts) {
                return { locked: false, retryAfter: 0 };
            }

            // Locked — retrieve remaining TTL directly from Redis.
            // TTL returns -2 when the key is gone (race: expired between count and ttl).
            const remainingTtl = await redisStore.ttl(key);
            if (remainingTtl <= 0) {
                // Key expired or missing — treat as unlocked
                return { locked: false, retryAfter: 0 };
            }

            return { locked: true, retryAfter: remainingTtl };
        }
    }

    // ── In-memory fallback path ───────────────────────────────────────────
    const { windowMs } = config;
    const store = getStore();
    const now = Date.now();

    const entry = await store.get(key);
    if (!entry) {
        return { locked: false, retryAfter: 0 };
    }

    // Window expired — clean up and allow
    if (now - entry.firstAttempt >= windowMs) {
        await store.delete(key);
        return { locked: false, retryAfter: 0 };
    }

    // Within window — check threshold
    if (entry.count >= maxAttempts) {
        const elapsed = now - entry.firstAttempt;
        const remainingMs = windowMs - elapsed;
        const retryAfter = Math.ceil(remainingMs / 1000);
        return { locked: true, retryAfter };
    }

    return { locked: false, retryAfter: 0 };
}

/**
 * Record a failed attempt for an arbitrary lockout key.
 *
 * When Redis is available, uses an atomic INCR + conditional EXPIRE so no
 * read-modify-write race condition can occur under concurrent requests.
 * Falls back to the in-memory store path otherwise (single-threaded Node.js
 * makes the in-memory path inherently race-free).
 *
 * @param key - Unique string key identifying the subject (e.g. email, "email:ip")
 * @param config - Lockout thresholds to use for this record
 * @returns Whether the key is now locked, the attempt number, and retryAfter seconds
 *
 * @example
 * ```ts
 * const key = `${email}:${ip}`;
 * const result = await recordFailedAttemptByKey({
 *     key,
 *     config: { maxAttempts: 5, windowMs: 900_000 }
 * });
 * ```
 */
export async function recordFailedAttemptByKey({
    key,
    config
}: {
    key: string;
    config: LockoutConfig;
}): Promise<{ locked: boolean; attemptNumber: number; retryAfter: number }> {
    const { maxAttempts, windowMs } = config;

    // ── Redis path: INCR (atomic) + EXPIRE on first increment ────────────
    const redisStore = getRedisStore();
    if (redisStore) {
        const newCount = await redisStore.incr(key, windowMs);

        // newCount is undefined only when Redis is unavailable; fall through
        // to the in-memory path in that case.
        if (newCount !== undefined) {
            const locked = newCount >= maxAttempts;
            let retryAfter = 0;

            if (locked) {
                // TTL was set on the first INCR; read the remaining seconds.
                const remainingTtl = await redisStore.ttl(key);
                retryAfter = remainingTtl > 0 ? remainingTtl : 0;
            }

            return { locked, attemptNumber: newCount, retryAfter };
        }
    }

    // ── In-memory fallback path (single-threaded, no race condition) ──────
    const store = getStore();
    const now = Date.now();

    const existing = await store.get(key);

    let newEntry: LockoutEntry;

    if (existing && now - existing.firstAttempt < windowMs) {
        // Within window — increment
        newEntry = {
            count: existing.count + 1,
            firstAttempt: existing.firstAttempt
        };
    } else {
        // Window expired or no entry — start fresh
        newEntry = {
            count: 1,
            firstAttempt: now
        };
    }

    await store.set(key, newEntry, windowMs);

    const locked = newEntry.count >= maxAttempts;
    let retryAfter = 0;
    if (locked) {
        const elapsed = now - newEntry.firstAttempt;
        const remainingMs = windowMs - elapsed;
        retryAfter = Math.ceil(remainingMs / 1000);
    }

    return {
        locked,
        attemptNumber: newEntry.count,
        retryAfter
    };
}

/**
 * Reset the lockout counter for an arbitrary key.
 *
 * @param key - Unique string key identifying the subject
 */
export async function resetLockoutByKey({ key }: { key: string }): Promise<void> {
    const store = getStore();
    await store.delete(key);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if an email is currently locked out.
 *
 * @returns locked=true and retryAfter (remaining seconds) if locked, otherwise locked=false
 */
export async function checkLockout({
    email
}: {
    email: string;
}): Promise<{ locked: boolean; retryAfter: number }> {
    const config = getConfig();
    const normalizedEmail = email.trim().toLowerCase();
    return checkLockoutByKey({ key: normalizedEmail, config });
}

/**
 * Record a failed login attempt for an email.
 *
 * @returns Whether the account is now locked, the attempt number, and retryAfter seconds
 */
export async function recordFailedAttempt({
    email
}: {
    email: string;
}): Promise<{ locked: boolean; attemptNumber: number; retryAfter: number }> {
    const config = getConfig();
    const normalizedEmail = email.trim().toLowerCase();
    return recordFailedAttemptByKey({ key: normalizedEmail, config });
}

/**
 * Reset the lockout counter for an email (call on successful login).
 */
export async function resetLockout({ email }: { email: string }): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    return resetLockoutByKey({ key: normalizedEmail });
}

/**
 * Clear all lockout state. For testing only.
 */
export async function clearLockoutStore(): Promise<void> {
    const store = getStore();
    await store.clear();
    memoryStore.clear();
}

/**
 * Reset store selection so it will be re-evaluated on next call.
 * For testing only.
 */
export function resetLockoutStore(): void {
    activeStore = undefined;
    memoryStore.clear();
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = undefined;
    }
}

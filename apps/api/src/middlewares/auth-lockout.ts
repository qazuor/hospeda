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

const REDIS_KEY_PREFIX = 'lockout:';

const createRedisStore = (): LockoutStore => ({
    async get(email: string): Promise<LockoutEntry | undefined> {
        try {
            const redis = await getRedisClient();
            if (!redis) return inMemoryStore.get(email);

            const data = await redis.get(`${REDIS_KEY_PREFIX}${email}`);
            if (!data) return undefined;
            return JSON.parse(data) as LockoutEntry;
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable for lockout, falling back to in-memory');
            return inMemoryStore.get(email);
        }
    },
    async set(email: string, entry: LockoutEntry, windowMs: number): Promise<void> {
        try {
            const redis = await getRedisClient();
            if (!redis) {
                await inMemoryStore.set(email, entry, windowMs);
                return;
            }

            const ttlSeconds = Math.ceil(windowMs / 1000);
            await redis.set(`${REDIS_KEY_PREFIX}${email}`, JSON.stringify(entry), 'EX', ttlSeconds);
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable for lockout, falling back to in-memory');
            await inMemoryStore.set(email, entry, windowMs);
        }
    },
    async delete(email: string): Promise<void> {
        try {
            const redis = await getRedisClient();
            if (!redis) {
                await inMemoryStore.delete(email);
                return;
            }

            await redis.del(`${REDIS_KEY_PREFIX}${email}`);
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable for lockout, falling back to in-memory');
            await inMemoryStore.delete(email);
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

/** Active store (lazy-initialized singleton) */
let activeStore: LockoutStore | undefined;

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
    const { maxAttempts, windowMs } = getConfig();
    const normalizedEmail = email.toLowerCase();
    const store = getStore();
    const now = Date.now();

    const entry = await store.get(normalizedEmail);
    if (!entry) {
        return { locked: false, retryAfter: 0 };
    }

    // Check if window has expired
    if (now - entry.firstAttempt >= windowMs) {
        await store.delete(normalizedEmail);
        return { locked: false, retryAfter: 0 };
    }

    // Within window, check count
    if (entry.count >= maxAttempts) {
        const elapsed = now - entry.firstAttempt;
        const remainingMs = windowMs - elapsed;
        const retryAfter = Math.ceil(remainingMs / 1000);
        return { locked: true, retryAfter };
    }

    return { locked: false, retryAfter: 0 };
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
    const { maxAttempts, windowMs } = getConfig();
    const normalizedEmail = email.toLowerCase();
    const store = getStore();
    const now = Date.now();

    const existing = await store.get(normalizedEmail);

    let newEntry: LockoutEntry;

    if (existing && now - existing.firstAttempt < windowMs) {
        // Within window.. increment
        newEntry = {
            count: existing.count + 1,
            firstAttempt: existing.firstAttempt
        };
    } else {
        // Window expired or no entry.. start fresh
        newEntry = {
            count: 1,
            firstAttempt: now
        };
    }

    await store.set(normalizedEmail, newEntry, windowMs);

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
 * Reset the lockout counter for an email (call on successful login).
 */
export async function resetLockout({ email }: { email: string }): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const store = getStore();
    await store.delete(normalizedEmail);
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

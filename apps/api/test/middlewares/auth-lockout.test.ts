/// <reference types="vitest/globals" />
/**
 * Unit tests for the auth-lockout store middleware.
 *
 * Covers in-memory store behavior, Redis delegation, email normalization,
 * window expiry via fake timers, and lockout threshold logic.
 *
 * @module test/middlewares/auth-lockout
 */

import {
    checkLockout,
    checkLockoutByKey,
    clearLockoutStore,
    recordFailedAttempt,
    recordFailedAttemptByKey,
    resetLockout,
    resetLockoutByKey,
    resetLockoutStore
} from '../../src/middlewares/auth-lockout';
import type { LockoutConfig } from '../../src/middlewares/auth-lockout';
import { getRedisClient } from '../../src/utils/redis';

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    }
}));

describe('auth-lockout store', () => {
    beforeEach(async () => {
        // Reset env to known defaults before every test
        process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS = '5';
        process.env.HOSPEDA_AUTH_LOCKOUT_WINDOW_MS = '900000';
        // Ensure no Redis URL leaks between tests
        process.env.HOSPEDA_REDIS_URL = undefined as unknown as string;
        // Clear all stored state and reset singleton selection
        await clearLockoutStore();
        resetLockoutStore();
        // Clear mock call history
        vi.mocked(getRedisClient).mockReset();
    });

    // ─── Lockout Threshold Tests ───────────────────────────────────────────

    it('should allow login when no previous failed attempts', async () => {
        // Arrange
        const email = 'clean@example.com';

        // Act
        const result = await checkLockout({ email });

        // Assert
        expect(result.locked).toBe(false);
        expect(result.retryAfter).toBe(0);
    });

    it('should allow login when failed attempts are below threshold', async () => {
        // Arrange
        const email = 'below@example.com';

        // Act — record 4 attempts (threshold is 5)
        for (let i = 0; i < 4; i++) {
            await recordFailedAttempt({ email });
        }
        const result = await checkLockout({ email });

        // Assert
        expect(result.locked).toBe(false);
    });

    it('should lock account after reaching threshold', async () => {
        // Arrange
        const email = 'locked@example.com';

        // Act — record exactly max attempts (5)
        for (let i = 0; i < 5; i++) {
            await recordFailedAttempt({ email });
        }
        const result = await checkLockout({ email });

        // Assert
        expect(result.locked).toBe(true);
        expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should return correct retryAfter in seconds', async () => {
        // Arrange
        const email = 'retry@example.com';
        const windowMs = 900000;
        const expectedMaxRetryAfter = Math.ceil(windowMs / 1000); // 900

        // Act — trigger lockout
        for (let i = 0; i < 5; i++) {
            await recordFailedAttempt({ email });
        }
        const result = await checkLockout({ email });

        // Assert — retryAfter must be a reasonable positive value close to windowMs/1000
        expect(result.locked).toBe(true);
        expect(result.retryAfter).toBeGreaterThan(0);
        // Allow a small delta for the time elapsed during the test (<= 2 seconds)
        expect(result.retryAfter).toBeLessThanOrEqual(expectedMaxRetryAfter);
        expect(result.retryAfter).toBeGreaterThanOrEqual(expectedMaxRetryAfter - 2);
    });

    // ─── Window Expiry Test ────────────────────────────────────────────────

    it('should unlock account after window expires', async () => {
        // Arrange
        vi.useFakeTimers();
        const email = 'expiry@example.com';

        // Act — trigger lockout
        for (let i = 0; i < 5; i++) {
            await recordFailedAttempt({ email });
        }

        // Advance time past the 900 000 ms window
        vi.advanceTimersByTime(900001);

        const result = await checkLockout({ email });

        // Restore real timers before assertions so afterEach cleanup works correctly
        vi.useRealTimers();

        // Assert
        expect(result.locked).toBe(false);
        expect(result.retryAfter).toBe(0);
    });

    // ─── Reset Lockout Test ────────────────────────────────────────────────

    it('should reset counter on successful login', async () => {
        // Arrange
        const email = 'reset@example.com';

        // Record 3 failed attempts
        for (let i = 0; i < 3; i++) {
            await recordFailedAttempt({ email });
        }

        // Act — simulate successful login
        await resetLockout({ email });

        // The very next failure must start a fresh counter
        const afterReset = await recordFailedAttempt({ email });

        // Assert
        expect(afterReset.attemptNumber).toBe(1);
    });

    // ─── Redis Store Test ──────────────────────────────────────────────────

    it('should use Redis INCR when HOSPEDA_REDIS_URL is set', async () => {
        // Arrange — mock redis with INCR returning 1 (first attempt)
        const mockRedis = {
            incr: vi.fn().mockResolvedValue(1),
            expire: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            ttl: vi.fn().mockResolvedValue(900)
        };

        vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);

        // Set env var and force re-evaluation of store singleton
        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        const email = 'redis@example.com';

        // Act
        const result = await recordFailedAttempt({ email });

        // Assert — INCR must be called with a key that starts with 'lockout:'
        expect(mockRedis.incr).toHaveBeenCalled();
        const incrKey: string = mockRedis.incr.mock.calls[0]?.[0] as string;
        expect(incrKey).toMatch(/^lockout:/);

        // EXPIRE must be called on the first INCR (newCount === 1)
        expect(mockRedis.expire).toHaveBeenCalled();
        expect(result.attemptNumber).toBe(1);
        expect(result.locked).toBe(false);
    });

    it('should not call EXPIRE on subsequent Redis INCR calls', async () => {
        // Arrange — mock INCR returning 2 (not the first attempt)
        const mockRedis = {
            incr: vi.fn().mockResolvedValue(2),
            expire: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            ttl: vi.fn().mockResolvedValue(850)
        };

        vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);

        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        // Act
        await recordFailedAttempt({ email: 'redis2@example.com' });

        // Assert — EXPIRE must NOT be called for non-first increments
        expect(mockRedis.incr).toHaveBeenCalledTimes(1);
        expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should use Redis GET + TTL for checkLockout when locked', async () => {
        // Arrange — count at threshold (5), TTL at 800 seconds remaining
        const mockRedis = {
            incr: vi.fn().mockResolvedValue(5),
            expire: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockResolvedValue('5'),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            ttl: vi.fn().mockResolvedValue(800)
        };

        vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);

        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        // Act
        const result = await checkLockout({ email: 'locked-redis@example.com' });

        // Assert — must use GET (count) and TTL commands
        expect(mockRedis.get).toHaveBeenCalled();
        expect(mockRedis.ttl).toHaveBeenCalled();
        expect(result.locked).toBe(true);
        expect(result.retryAfter).toBe(800);
    });

    it('should return locked=false via Redis GET when count is below threshold', async () => {
        // Arrange — count below threshold (2 out of 5)
        const mockRedis = {
            incr: vi.fn().mockResolvedValue(2),
            expire: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockResolvedValue('2'),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            ttl: vi.fn().mockResolvedValue(850)
        };

        vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);

        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        // Act
        const result = await checkLockout({ email: 'below-redis@example.com' });

        // Assert — not locked, TTL not needed
        expect(result.locked).toBe(false);
        expect(result.retryAfter).toBe(0);
        expect(mockRedis.ttl).not.toHaveBeenCalled();
    });

    // ─── In-Memory Fallback Test ───────────────────────────────────────────

    it('should fall back to in-memory store when Redis is unavailable at runtime', async () => {
        // Arrange — REDIS_URL is set but getRedisClient returns undefined (connection failed)
        const mockRedis = {
            incr: vi.fn(),
            expire: vi.fn(),
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            ttl: vi.fn()
        };
        // Simulate Redis connection failure: getRedisClient returns undefined
        vi.mocked(getRedisClient).mockResolvedValue(undefined);

        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        const email = 'inmemory@example.com';

        // Act
        const result = await recordFailedAttempt({ email });

        // Assert — incr returned undefined (Redis unavailable), so the
        // in-memory fallback was used and the attempt was recorded.
        expect(result.attemptNumber).toBe(1);
        expect(result.locked).toBe(false);
        // Redis-specific commands must NOT have been invoked on the mock
        expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    // ─── Email Normalization Test ──────────────────────────────────────────

    it('should normalize email to lowercase', async () => {
        // Arrange — record an attempt using mixed-case email
        const mixedCaseEmail = 'User@Example.COM';
        const lowercaseEmail = 'user@example.com';

        // Act
        await recordFailedAttempt({ email: mixedCaseEmail });

        // Check lockout using the lowercase equivalent
        const result = await checkLockout({ email: lowercaseEmail });

        // Assert — counter is shared; 1 attempt is not enough to lock but
        // confirms the entry exists under the normalized key
        expect(result.locked).toBe(false);

        // Continue until lockout using the lowercase form
        for (let i = 1; i < 5; i++) {
            await recordFailedAttempt({ email: lowercaseEmail });
        }
        const lockedResult = await checkLockout({ email: mixedCaseEmail });
        expect(lockedResult.locked).toBe(true);
    });

    // ─── Whitespace Normalization Test ────────────────────────────────────

    it('should trim whitespace from email before using as lookup key', async () => {
        // Arrange — record an attempt using an email with leading/trailing spaces
        const emailWithSpaces = '  user@example.com  ';
        const trimmedEmail = 'user@example.com';

        // Act
        await recordFailedAttempt({ email: emailWithSpaces });

        // Assert — checking with the trimmed form finds the same entry
        const result = await checkLockout({ email: trimmedEmail });
        expect(result.locked).toBe(false); // 1 attempt is not enough to lock

        // Continue until lockout using the padded form to confirm shared key
        for (let i = 1; i < 5; i++) {
            await recordFailedAttempt({ email: emailWithSpaces });
        }
        const lockedResult = await checkLockout({ email: trimmedEmail });
        expect(lockedResult.locked).toBe(true);
    });

    it('should treat email with spaces and trimmed email as the same account for resetLockout', async () => {
        // Arrange — trigger lockout with padded email
        const emailWithSpaces = '  reset-ws@example.com  ';
        const trimmedEmail = 'reset-ws@example.com';

        for (let i = 0; i < 5; i++) {
            await recordFailedAttempt({ email: emailWithSpaces });
        }

        // Act — reset using trimmed form
        await resetLockout({ email: trimmedEmail });

        // Assert — lockout is cleared regardless of which form was used
        const result = await checkLockout({ email: emailWithSpaces });
        expect(result.locked).toBe(false);
    });

    // ─── Attempt Number Tracking Test ─────────────────────────────────────

    it('should track attempt number correctly', async () => {
        // Arrange
        const email = 'tracking@example.com';

        // Act — record 3 sequential attempts and capture each return value
        const first = await recordFailedAttempt({ email });
        const second = await recordFailedAttempt({ email });
        const third = await recordFailedAttempt({ email });

        // Assert
        expect(first.attemptNumber).toBe(1);
        expect(second.attemptNumber).toBe(2);
        expect(third.attemptNumber).toBe(3);
    });
});

// ─── Key-based API tests (composite keys for forgot-password) ─────────────────

describe('auth-lockout key-based API', () => {
    /** Custom config used across all key-based tests. */
    const config: LockoutConfig = { maxAttempts: 3, windowMs: 300_000 }; // 5 minutes

    beforeEach(async () => {
        process.env.HOSPEDA_REDIS_URL = undefined as unknown as string;
        await clearLockoutStore();
        resetLockoutStore();
        vi.mocked(getRedisClient).mockReset();
    });

    // ─── checkLockoutByKey ────────────────────────────────────────────────

    it('should return locked=false when no attempts recorded for key', async () => {
        // Arrange
        const key = 'forgot-password:user@example.com:1.2.3.4';

        // Act
        const result = await checkLockoutByKey({ key, config });

        // Assert
        expect(result.locked).toBe(false);
        expect(result.retryAfter).toBe(0);
    });

    it('should return locked=false when attempts are below threshold', async () => {
        // Arrange
        const key = 'forgot-password:below@example.com:1.2.3.4';

        // Act — record 2 attempts (threshold is 3)
        for (let i = 0; i < 2; i++) {
            await recordFailedAttemptByKey({ key, config });
        }
        const result = await checkLockoutByKey({ key, config });

        // Assert
        expect(result.locked).toBe(false);
    });

    it('should return locked=true after reaching threshold', async () => {
        // Arrange
        const key = 'forgot-password:locked@example.com:1.2.3.4';

        // Act — record exactly maxAttempts (3)
        for (let i = 0; i < 3; i++) {
            await recordFailedAttemptByKey({ key, config });
        }
        const result = await checkLockoutByKey({ key, config });

        // Assert
        expect(result.locked).toBe(true);
        expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should return retryAfter within expected window range', async () => {
        // Arrange
        const key = 'forgot-password:retry@example.com:1.2.3.4';
        const expectedMaxRetryAfter = Math.ceil(config.windowMs / 1000);

        // Act — trigger lockout
        for (let i = 0; i < 3; i++) {
            await recordFailedAttemptByKey({ key, config });
        }
        const result = await checkLockoutByKey({ key, config });

        // Assert
        expect(result.locked).toBe(true);
        expect(result.retryAfter).toBeGreaterThan(0);
        expect(result.retryAfter).toBeLessThanOrEqual(expectedMaxRetryAfter);
        expect(result.retryAfter).toBeGreaterThanOrEqual(expectedMaxRetryAfter - 2);
    });

    // ─── recordFailedAttemptByKey ─────────────────────────────────────────

    it('should increment attempt count on each call', async () => {
        // Arrange
        const key = 'forgot-password:track@example.com:1.2.3.4';

        // Act
        const first = await recordFailedAttemptByKey({ key, config });
        const second = await recordFailedAttemptByKey({ key, config });
        const third = await recordFailedAttemptByKey({ key, config });

        // Assert
        expect(first.attemptNumber).toBe(1);
        expect(second.attemptNumber).toBe(2);
        expect(third.attemptNumber).toBe(3);
        expect(third.locked).toBe(true);
    });

    it('should not lock before threshold', async () => {
        // Arrange
        const key = 'forgot-password:notlocked@example.com:1.2.3.4';

        // Act — record maxAttempts - 1 attempts
        const results: Awaited<ReturnType<typeof recordFailedAttemptByKey>>[] = [];
        for (let i = 0; i < 2; i++) {
            results.push(await recordFailedAttemptByKey({ key, config }));
        }

        // Assert — none should be locked
        for (const result of results) {
            expect(result.locked).toBe(false);
        }
    });

    // ─── resetLockoutByKey ────────────────────────────────────────────────

    it('should clear lockout state for the given key', async () => {
        // Arrange — trigger lockout
        const key = 'forgot-password:reset@example.com:1.2.3.4';
        for (let i = 0; i < 3; i++) {
            await recordFailedAttemptByKey({ key, config });
        }

        // Act — reset
        await resetLockoutByKey({ key });

        // Assert — next attempt starts fresh at count=1
        const afterReset = await recordFailedAttemptByKey({ key, config });
        expect(afterReset.attemptNumber).toBe(1);
        expect(afterReset.locked).toBe(false);
    });

    it('should not affect a different key when resetting', async () => {
        // Arrange — lock two keys
        const key1 = 'forgot-password:a@example.com:1.2.3.4';
        const key2 = 'forgot-password:b@example.com:1.2.3.4';
        for (let i = 0; i < 3; i++) {
            await recordFailedAttemptByKey({ key: key1, config });
            await recordFailedAttemptByKey({ key: key2, config });
        }

        // Act — reset only key1
        await resetLockoutByKey({ key: key1 });

        // Assert — key2 remains locked, key1 is unlocked
        const result1 = await checkLockoutByKey({ key: key1, config });
        const result2 = await checkLockoutByKey({ key: key2, config });

        expect(result1.locked).toBe(false);
        expect(result2.locked).toBe(true);
    });

    // ─── Composite key isolation ──────────────────────────────────────────

    it('should isolate lockout by IP: same email + different IP are independent', async () => {
        // Arrange
        const email = 'user@example.com';
        const key1 = `forgot-password:${email}:1.2.3.4`;
        const key2 = `forgot-password:${email}:5.6.7.8`;

        // Act — lock out IP 1.2.3.4
        for (let i = 0; i < 3; i++) {
            await recordFailedAttemptByKey({ key: key1, config });
        }

        // Assert — key2 (different IP) is not locked
        const result1 = await checkLockoutByKey({ key: key1, config });
        const result2 = await checkLockoutByKey({ key: key2, config });

        expect(result1.locked).toBe(true);
        expect(result2.locked).toBe(false);
    });

    it('should unlock after window expires', async () => {
        // Arrange
        vi.useFakeTimers();
        const key = 'forgot-password:expiry@example.com:1.2.3.4';

        // Act — trigger lockout
        for (let i = 0; i < 3; i++) {
            await recordFailedAttemptByKey({ key, config });
        }

        // Advance time past the 300 000 ms window
        vi.advanceTimersByTime(300_001);

        const result = await checkLockoutByKey({ key, config });

        vi.useRealTimers();

        // Assert
        expect(result.locked).toBe(false);
        expect(result.retryAfter).toBe(0);
    });

    // ─── Concurrency Tests (GAP-011) ──────────────────────────────────────

    it('should document in-memory race condition under concurrent Promise.all load', async () => {
        // Arrange
        // The in-memory store uses a read-modify-write pattern (get → increment → set).
        // Under concurrent Promise.all calls, multiple coroutines can read the same
        // initial state before any write completes, causing lost updates (count stays at 1).
        //
        // This test intentionally asserts the ACTUAL in-memory behavior so that the
        // contrast with the atomic Redis INCR path is clear. Use Redis in production
        // for multi-instance or high-concurrency deployments.
        const key = 'concurrent:inmemory@example.com:9.9.9.9';
        const concurrentAttempts = 5;

        // Act — fire all attempts simultaneously via Promise.all
        const results = await Promise.all(
            Array.from({ length: concurrentAttempts }, () =>
                recordFailedAttemptByKey({ key, config: { maxAttempts: 10, windowMs: 300_000 } })
            )
        );

        // Assert — in-memory store exhibits lost updates under concurrent load:
        // all coroutines read count=0 before any write completes, so every call
        // records attemptNumber=1. The final stored count is also 1 (last writer wins).
        const attemptNumbers = results.map((r) => r.attemptNumber);
        expect(attemptNumbers.every((n) => n === 1)).toBe(true);

        // Final check — only 1 attempt was effectively stored (last write wins)
        const finalCheck = await checkLockoutByKey({
            key,
            config: { maxAttempts: 1, windowMs: 300_000 }
        });
        // With maxAttempts=1 and final count=1, the account is locked
        expect(finalCheck.locked).toBe(true);
    });

    it('should demonstrate why Redis INCR is required for concurrent lockout correctness', async () => {
        // Arrange — this test contrasts the in-memory and Redis paths side-by-side.
        //
        // In-memory: concurrent reads all see count=0 before any write → lost updates.
        // Redis INCR: each call increments atomically → no lost updates guaranteed.
        //
        // Both are tested here to document the architectural tradeoff.
        const concurrentAttempts = 3;

        // ── In-memory path ────────────────────────────────────────────────
        // All coroutines read the same initial state (count=0) before any
        // write occurs, so every caller writes back count=1.
        const inmemKey = 'concurrent:contrast-inmem@example.com:9.9.9.9';
        const inmemResults = await Promise.all(
            Array.from({ length: concurrentAttempts }, () =>
                recordFailedAttemptByKey({
                    key: inmemKey,
                    config: { maxAttempts: 10, windowMs: 300_000 }
                })
            )
        );

        // All in-memory results report attemptNumber=1 due to lost updates
        const inmemAttemptNumbers = inmemResults.map((r) => r.attemptNumber);
        expect(inmemAttemptNumbers.every((n) => n === 1)).toBe(true);

        // ── Redis path ────────────────────────────────────────────────────
        // Each INCR returns a unique monotonically increasing value.
        let redisCounter = 0;
        const mockRedis = {
            incr: vi.fn().mockImplementation(() => Promise.resolve(++redisCounter)),
            expire: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            ttl: vi.fn().mockResolvedValue(290)
        };
        vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);
        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        const redisKey = 'concurrent:contrast-redis@example.com:9.9.9.9';
        const redisResults = await Promise.all(
            Array.from({ length: concurrentAttempts }, () =>
                recordFailedAttemptByKey({
                    key: redisKey,
                    config: { maxAttempts: 10, windowMs: 300_000 }
                })
            )
        );

        // Redis results reflect the sequential atomic counter — all unique values
        const redisAttemptNumbers = redisResults.map((r) => r.attemptNumber).sort((a, b) => a - b);
        expect(redisAttemptNumbers).toEqual([1, 2, 3]);
    });

    it('should count all concurrent Redis attempts atomically via INCR', async () => {
        // Arrange — simulate Redis INCR atomicity: each call returns the next
        // monotonically increasing integer. In a real Redis instance, INCR is
        // guaranteed to be atomic regardless of concurrent callers.
        const concurrentAttempts = 6;
        let counter = 0;

        const mockRedis = {
            // Each call to incr atomically returns the next value in the sequence,
            // simulating Redis INCR semantics under concurrent load.
            incr: vi.fn().mockImplementation(() => Promise.resolve(++counter)),
            expire: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockImplementation(() => Promise.resolve(String(counter))),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            ttl: vi.fn().mockResolvedValue(290)
        };

        vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);
        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        const key = 'concurrent:redis@example.com:9.9.9.9';

        // Act — fire all attempts simultaneously
        const results = await Promise.all(
            Array.from({ length: concurrentAttempts }, () =>
                recordFailedAttemptByKey({ key, config: { maxAttempts: 5, windowMs: 300_000 } })
            )
        );

        // Assert — Redis INCR must have been called exactly concurrentAttempts times.
        expect(mockRedis.incr).toHaveBeenCalledTimes(concurrentAttempts);

        // Each INCR call must use the same key (all for the same subject).
        const incrKeys = mockRedis.incr.mock.calls.map((call) => call[0] as string);
        const uniqueKeys = new Set(incrKeys);
        expect(uniqueKeys.size).toBe(1);
        expect([...uniqueKeys][0]).toMatch(/^lockout:/);

        // EXPIRE must be called exactly once (only when newCount === 1).
        expect(mockRedis.expire).toHaveBeenCalledTimes(1);

        // The attempt numbers returned must match the sequence returned by INCR.
        // No count may be duplicated (no lost updates).
        const attemptNumbers = results.map((r) => r.attemptNumber).sort((a, b) => a - b);
        expect(attemptNumbers).toEqual([1, 2, 3, 4, 5, 6]);

        // Attempts at or above maxAttempts=5 must be locked.
        const lockedResults = results.filter((r) => r.locked);
        expect(lockedResults.length).toBe(2); // attempts 5 and 6
        for (const r of lockedResults) {
            expect(r.attemptNumber).toBeGreaterThanOrEqual(5);
        }
    });

    it('should not call EXPIRE more than once even with many concurrent Redis INCRs', async () => {
        // Arrange — simulate Redis INCR with sequential values starting at 1.
        // Only the first call returns 1; all others return values > 1.
        // EXPIRE must be called exactly once regardless of concurrency.
        let counter = 0;

        const mockRedis = {
            incr: vi.fn().mockImplementation(() => Promise.resolve(++counter)),
            expire: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            ttl: vi.fn().mockResolvedValue(300)
        };

        vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);
        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        const key = 'concurrent:expire@example.com:9.9.9.9';

        // Act — fire 10 concurrent attempts
        await Promise.all(
            Array.from({ length: 10 }, () =>
                recordFailedAttemptByKey({ key, config: { maxAttempts: 20, windowMs: 300_000 } })
            )
        );

        // Assert — INCR called 10 times but EXPIRE only once (for the first INCR)
        expect(mockRedis.incr).toHaveBeenCalledTimes(10);
        expect(mockRedis.expire).toHaveBeenCalledTimes(1);
    });
});

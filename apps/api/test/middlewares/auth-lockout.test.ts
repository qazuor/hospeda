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
    clearLockoutStore,
    recordFailedAttempt,
    resetLockout,
    resetLockoutStore
} from '../../src/middlewares/auth-lockout';
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

    it('should use Redis store when HOSPEDA_REDIS_URL is set', async () => {
        // Arrange
        const mockRedis = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1)
        };

        vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);

        // Set env var and force re-evaluation of store singleton
        process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
        resetLockoutStore();

        const email = 'redis@example.com';

        // Act
        await recordFailedAttempt({ email });

        // Assert — Redis set must have been called with a key that starts with 'lockout:'
        expect(mockRedis.set).toHaveBeenCalled();
        const setKey: string = mockRedis.set.mock.calls[0]?.[0] as string;
        expect(setKey).toMatch(/^lockout:/);
    });

    // ─── In-Memory Fallback Test ───────────────────────────────────────────

    it('should fall back to in-memory store when Redis unavailable', async () => {
        // Arrange — no HOSPEDA_REDIS_URL means inMemoryStore is used
        // (delete already done in beforeEach)
        const email = 'inmemory@example.com';

        // Act
        const result = await recordFailedAttempt({ email });

        // Assert — works without error and Redis was never called
        expect(result.attemptNumber).toBe(1);
        expect(getRedisClient).not.toHaveBeenCalled();
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

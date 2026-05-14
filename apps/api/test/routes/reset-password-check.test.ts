/**
 * @file reset-password-check.test.ts
 *
 * Unit tests for the SPEC-118 reset-password token check handler.
 *
 * Tests target the pure `checkResetPasswordToken` function with an injected
 * mock `db` (dependency injection). This avoids mocking the entire `@repo/db`
 * barrel, which transitively pulls in unbuilt workspace packages
 * (`@repo/media/server`, etc.) and breaks the test runtime.
 *
 * Cases:
 * - valid (live) token → { valid: true }
 * - row exists but expiresAt past now → { valid: false, reason: 'expired' }
 * - no row found → { valid: false, reason: 'invalid' }
 * - DB throws → fail-closed to { valid: false, reason: 'invalid' }
 * - expiresAt === now → expired (boundary)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture logger errors so we can introspect what the fail-closed branch saw.
// vi.hoisted lets us share state with the hoisted vi.mock factory.
const { loggerErrorMock } = vi.hoisted(() => ({ loggerErrorMock: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        error: loggerErrorMock,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { checkResetPasswordToken } from '../../src/routes/auth/reset-password-check';

/**
 * Builds a minimal chainable mock matching the Drizzle SELECT shape the
 * handler uses: `db.select(...).from(...).where(...).limit(1)` resolving to
 * the supplied rows.
 */
const buildMockDb = (rows: Array<{ expiresAt: Date }>) => {
    const limitMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle client surface is large; we only stub what the handler touches.
    return { select: selectMock } as any;
};

/** A db whose `select()` throws synchronously, simulating an infra failure. */
const buildThrowingDb = () =>
    ({
        select: vi.fn().mockImplementation(() => {
            throw new Error('connection refused');
        })
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle client surface is large; we only stub what the handler touches.
    }) as any;

describe('checkResetPasswordToken (SPEC-118)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('returns valid:true when a live verification row matches the token', async () => {
        const futureExpiry = new Date(Date.now() + 60_000);
        const db = buildMockDb([{ expiresAt: futureExpiry }]);

        const result = await checkResetPasswordToken({ token: 'good-token', db });

        expect(result).toEqual({ valid: true });
        expect(loggerErrorMock).not.toHaveBeenCalled();
    });

    it('returns reason:expired when the row exists but expiresAt is past', async () => {
        const pastExpiry = new Date(Date.now() - 60_000);
        const db = buildMockDb([{ expiresAt: pastExpiry }]);

        const result = await checkResetPasswordToken({ token: 'expired-token', db });

        expect(result).toEqual({ valid: false, reason: 'expired' });
    });

    it('returns reason:invalid when no verification row matches (used/tampered/unknown)', async () => {
        const db = buildMockDb([]);

        const result = await checkResetPasswordToken({ token: 'missing-token', db });

        expect(result).toEqual({ valid: false, reason: 'invalid' });
    });

    it('fail-closes to reason:invalid when the database throws', async () => {
        const db = buildThrowingDb();

        const result = await checkResetPasswordToken({ token: 'any-token', db });

        expect(result).toEqual({ valid: false, reason: 'invalid' });
    });

    it('treats expiresAt exactly equal to now as expired (boundary)', async () => {
        const fixedNow = 1_700_000_000_000;
        vi.setSystemTime(new Date(fixedNow));
        const db = buildMockDb([{ expiresAt: new Date(fixedNow) }]);

        const result = await checkResetPasswordToken({ token: 'boundary-token', db });

        expect(result).toEqual({ valid: false, reason: 'expired' });
    });
});

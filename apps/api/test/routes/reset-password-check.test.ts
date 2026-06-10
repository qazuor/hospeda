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
 * - WHERE clause uses identifier = 'reset-password:<token>' (regression guard)
 */

import { verifications } from '@repo/db';
import { eq } from 'drizzle-orm';
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

/**
 * Same as `buildMockDb` but also returns the `whereMock` spy so callers can
 * inspect the WHERE-clause argument that was passed to `.where(...)`.
 *
 * Used exclusively by the WHERE-clause regression guard test.
 */
const buildMockDbTracked = (rows: Array<{ expiresAt: Date }>) => {
    const limitMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle client surface is large; we only stub what the handler touches.
    const db = { select: selectMock } as any;
    return { db, whereMock };
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

    /**
     * Regression guard for the SPEC-118 lookup bug.
     *
     * The pre-fix implementation queried `WHERE value = token` (and a LIKE on
     * identifier). Better Auth 1.4.x stores reset-password verifications as
     * `identifier = 'reset-password:<token>'` / `value = userId`, so the old
     * WHERE never matched a real row — the endpoint always returned
     * `{valid:false, reason:'invalid'}`.
     *
     * This test captures the SQL condition object passed to `.where(...)` and
     * compares it — via deep equality on the Drizzle AST — against the
     * expected `eq(verifications.identifier, 'reset-password:<token>')`.
     *
     * If anyone reverts the lookup to `eq(verifications.value, token)` or
     * introduces a LIKE/AND expression, the captured argument will no longer
     * deep-equal the reference condition and this test will fail.
     */
    it('passes WHERE identifier = "reset-password:<token>" to the query (regression guard)', async () => {
        const token = 'regression-guard-token';
        const { db, whereMock } = buildMockDbTracked([
            { expiresAt: new Date(Date.now() + 60_000) }
        ]);

        await checkResetPasswordToken({ token, db });

        // The actual argument Drizzle received in .where(...)
        const receivedCondition = whereMock.mock.calls[0]?.[0];

        // The reference condition: what the fixed implementation SHOULD pass.
        // Constructed with the real drizzle-orm eq() and the real verifications
        // column so the AST node is identical to what the production code
        // builds. Any deviation (wrong column, wrong operator, wrong value,
        // missing prefix) will produce a structurally different object and
        // toEqual will fail.
        const expectedCondition = eq(verifications.identifier, `reset-password:${token}`);

        expect(receivedCondition).toEqual(expectedCondition);
    });
});

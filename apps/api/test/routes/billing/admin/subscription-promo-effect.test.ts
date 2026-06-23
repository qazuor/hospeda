/**
 * Unit Tests for getSubscriptionPromoEffectHandler
 *
 * Tests for the extracted handler that returns the active promo effect
 * on a subscription for admin dashboard display.
 *
 * The global test setup (test/setup.ts) provides the @repo/db mock via
 * createDbMock(). This file reconfigures getDb() per test to control
 * what the handler sees without leaking state between tests.
 *
 * The handler uses db.execute(sql`...`) — a single round-trip that LEFT JOINs
 * billing_promo_codes on billing_subscriptions. The mock returns
 * `{ rows: [...] }` to match the Drizzle execute() contract used by the real
 * production code (payment-logic.ts, dunning.job.ts).
 *
 * @module test/routes/billing/admin/subscription-promo-effect
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Partial mock of the env module: keep all real exports but override the `env`
// object so module-scope code in response-validator and cors middleware does not
// crash when createAdminRoute is imported in this test.
vi.mock('../../../../src/utils/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/env')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            NODE_ENV: 'test'
        },
        validateApiEnv: vi.fn()
    };
});

// Import after global mocks provided by setup.ts
import { getDb } from '@repo/db';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getSubscriptionPromoEffectHandler } from '../../../../src/routes/billing/admin/subscription-promo-effect';

/**
 * Minimal Hono context stub — the handler does not use the context directly;
 * all DB access goes through getDb() which is mocked globally.
 */
function createMockContext(): Context {
    return {} as unknown as Context;
}

/**
 * Configures getDb().execute() to resolve with the given rows.
 * Wraps rows in `{ rows }` to match the Drizzle execute() return contract.
 */
function buildMockDb(rows: unknown[]) {
    vi.mocked(getDb).mockReturnValue({
        execute: vi.fn().mockResolvedValue({ rows })
    } as unknown as ReturnType<typeof getDb>);
}

/**
 * Factory for a realistic DB row as returned by the LEFT JOIN query,
 * matching the PromoEffectRow interface in the handler.
 */
function makeRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    return {
        promo_code_id: 'promo-code-uuid-001',
        promo_effect_remaining_cycles: 2,
        code: 'SUMMER30',
        effect_kind: 'discount',
        value_kind: 'percentage',
        value: 30,
        duration_cycles: 3,
        extra_days: null,
        ...overrides
    };
}

// ---------------------------------------------------------------------------

const SUBSCRIPTION_ID = '11111111-1111-1111-1111-111111111111';
const PROMO_CODE_ID = 'promo-code-uuid-001';

describe('getSubscriptionPromoEffectHandler', () => {
    const ctx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Happy path: discount effect with remaining cycles
    // -------------------------------------------------------------------------

    describe('discount effect with remaining cycles', () => {
        it('should return hasPromo=true and correct discount fields', async () => {
            // Arrange: 30% discount, 2 cycles remaining out of 3
            buildMockDb([makeRow()]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert
            expect(result.hasPromo).toBe(true);
            expect(result.promoCodeId).toBe(PROMO_CODE_ID);
            expect(result.code).toBe('SUMMER30');
            expect(result.effectKind).toBe('discount');
            expect(result.valueKind).toBe('percentage');
            expect(result.value).toBe(30);
            expect(result.durationCycles).toBe(3);
            expect(result.remainingCycles).toBe(2);
            expect(result.extraDays).toBeNull();
            expect(result.exhausted).toBe(false);
        });

        it('should correctly shape a discount-with-2-remaining-cycles response', async () => {
            // Arrange: discount 20% fixed, 2 of 5 cycles remaining
            buildMockDb([
                makeRow({
                    code: 'FIXED20',
                    effect_kind: 'discount',
                    value_kind: 'fixed',
                    value: 2000,
                    duration_cycles: 5,
                    promo_effect_remaining_cycles: 2
                })
            ]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert — full response shape for the "discount-with-2-remaining-cycles" scenario
            expect(result).toEqual({
                hasPromo: true,
                promoCodeId: PROMO_CODE_ID,
                code: 'FIXED20',
                effectKind: 'discount',
                valueKind: 'fixed',
                value: 2000,
                durationCycles: 5,
                remainingCycles: 2,
                extraDays: null,
                exhausted: false
            });
        });
    });

    // -------------------------------------------------------------------------
    // Happy path: comp effect
    // -------------------------------------------------------------------------

    describe('comp effect', () => {
        it('should return effectKind=comp with null valueKind, value, durationCycles, extraDays', async () => {
            // Arrange: comp code (free forever)
            buildMockDb([
                makeRow({
                    code: 'HOSPEDA_FREE',
                    effect_kind: 'comp',
                    value_kind: null,
                    value: 0,
                    duration_cycles: null,
                    extra_days: null,
                    promo_effect_remaining_cycles: null
                })
            ]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert
            expect(result.hasPromo).toBe(true);
            expect(result.effectKind).toBe('comp');
            expect(result.valueKind).toBeNull();
            // comp rows keep value=0 (the DB column is NOT NULL DEFAULT 0), not
            // null. This is harmless because the comp branch renders before any
            // discount path; asserted here to lock the contract.
            expect(result.value).toBe(0);
            // comp effects are never considered "exhausted"
            expect(result.exhausted).toBe(false);
            expect(result.durationCycles).toBeNull();
            expect(result.remainingCycles).toBeNull();
            expect(result.extraDays).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // Happy path: trial_extension effect
    // -------------------------------------------------------------------------

    describe('trial_extension effect', () => {
        it('should return effectKind=trial_extension with extraDays populated', async () => {
            // Arrange: 30-day trial extension
            buildMockDb([
                makeRow({
                    code: 'FREEMONTH',
                    effect_kind: 'trial_extension',
                    value_kind: null,
                    value: 0,
                    duration_cycles: null,
                    extra_days: 30,
                    promo_effect_remaining_cycles: null
                })
            ]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert
            expect(result.hasPromo).toBe(true);
            expect(result.effectKind).toBe('trial_extension');
            expect(result.extraDays).toBe(30);
            expect(result.valueKind).toBeNull();
            expect(result.durationCycles).toBeNull();
            expect(result.remainingCycles).toBeNull();
            expect(result.exhausted).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Happy path: no promo attached
    // -------------------------------------------------------------------------

    describe('no promo on subscription', () => {
        it('should return hasPromo=false with all nullable fields as null', async () => {
            // Arrange: subscription exists but no promo code linked
            buildMockDb([
                makeRow({
                    promo_code_id: null,
                    promo_effect_remaining_cycles: null,
                    code: null,
                    effect_kind: null,
                    value_kind: null,
                    value: null,
                    duration_cycles: null,
                    extra_days: null
                })
            ]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert
            expect(result.hasPromo).toBe(false);
            expect(result.promoCodeId).toBeNull();
            expect(result.code).toBeNull();
            expect(result.effectKind).toBeNull();
            expect(result.valueKind).toBeNull();
            expect(result.value).toBeNull();
            expect(result.durationCycles).toBeNull();
            expect(result.remainingCycles).toBeNull();
            expect(result.extraDays).toBeNull();
            expect(result.exhausted).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Exhausted discount: remainingCycles === 0
    // -------------------------------------------------------------------------

    describe('exhausted discount', () => {
        it('should set exhausted=true when effectKind=discount and remainingCycles=0', async () => {
            // Arrange: 1-cycle discount that has been consumed
            buildMockDb([
                makeRow({
                    effect_kind: 'discount',
                    value_kind: 'percentage',
                    value: 50,
                    duration_cycles: 1,
                    promo_effect_remaining_cycles: 0
                })
            ]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert
            expect(result.hasPromo).toBe(true);
            expect(result.effectKind).toBe('discount');
            expect(result.remainingCycles).toBe(0);
            expect(result.exhausted).toBe(true);
        });

        it('should set exhausted=false when effectKind=discount and remainingCycles=null (forever)', async () => {
            // Arrange: forever discount (null remaining = never exhausted)
            buildMockDb([
                makeRow({
                    effect_kind: 'discount',
                    value_kind: 'percentage',
                    value: 20,
                    duration_cycles: null,
                    promo_effect_remaining_cycles: null
                })
            ]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert
            expect(result.remainingCycles).toBeNull();
            expect(result.exhausted).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // 404 for unknown subscription id
    // -------------------------------------------------------------------------

    describe('404 for unknown subscription', () => {
        it('should throw HTTPException(404) when db.execute returns empty rows', async () => {
            // Arrange: no row found for the given subscription id
            buildMockDb([]);

            // Act & Assert
            await expect(
                getSubscriptionPromoEffectHandler(ctx, {
                    id: '99999999-9999-9999-9999-999999999999'
                })
            ).rejects.toThrow(HTTPException);
        });

        it('should throw HTTPException with status 404 for unknown id', async () => {
            // Arrange
            buildMockDb([]);

            // Act
            let caughtError: unknown;
            try {
                await getSubscriptionPromoEffectHandler(ctx, {
                    id: '99999999-9999-9999-9999-999999999999'
                });
            } catch (err) {
                caughtError = err;
            }

            // Assert
            expect(caughtError).toBeInstanceOf(HTTPException);
            expect((caughtError as HTTPException).status).toBe(404);
        });
    });

    // -------------------------------------------------------------------------
    // DB error → 500
    // -------------------------------------------------------------------------

    describe('error handling', () => {
        it('should throw HTTPException(500) when db.execute rejects', async () => {
            // Arrange: simulate a DB connection failure
            vi.mocked(getDb).mockReturnValue({
                execute: vi.fn().mockRejectedValue(new Error('DB connection lost'))
            } as unknown as ReturnType<typeof getDb>);

            // Act & Assert
            await expect(
                getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID })
            ).rejects.toThrow('Failed to retrieve subscription promo effect');
        });

        it('should wrap db errors in HTTPException(500)', async () => {
            // Arrange
            vi.mocked(getDb).mockReturnValue({
                execute: vi.fn().mockRejectedValue(new Error('timeout'))
            } as unknown as ReturnType<typeof getDb>);

            // Act
            let caughtError: unknown;
            try {
                await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });
            } catch (err) {
                caughtError = err;
            }

            // Assert
            expect(caughtError).toBeInstanceOf(HTTPException);
            expect((caughtError as HTTPException).status).toBe(500);
        });
    });

    // -------------------------------------------------------------------------
    // Response shape invariants
    // -------------------------------------------------------------------------

    describe('response shape', () => {
        it('should always include all expected fields', async () => {
            // Arrange
            buildMockDb([makeRow()]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert — every field must be present (not undefined)
            expect(result).toHaveProperty('hasPromo');
            expect(result).toHaveProperty('promoCodeId');
            expect(result).toHaveProperty('code');
            expect(result).toHaveProperty('effectKind');
            expect(result).toHaveProperty('valueKind');
            expect(result).toHaveProperty('value');
            expect(result).toHaveProperty('durationCycles');
            expect(result).toHaveProperty('remainingCycles');
            expect(result).toHaveProperty('extraDays');
            expect(result).toHaveProperty('exhausted');
        });

        it('should coerce unknown effect_kind to null', async () => {
            // Arrange: DB returns an unknown effect_kind value
            buildMockDb([makeRow({ effect_kind: 'unknown_kind' })]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert
            expect(result.effectKind).toBeNull();
            expect(result.exhausted).toBe(false);
        });

        it('should coerce unknown value_kind to null', async () => {
            // Arrange: DB returns an unknown value_kind
            buildMockDb([makeRow({ value_kind: 'crypto' })]);

            // Act
            const result = await getSubscriptionPromoEffectHandler(ctx, { id: SUBSCRIPTION_ID });

            // Assert
            expect(result.valueKind).toBeNull();
        });
    });
});

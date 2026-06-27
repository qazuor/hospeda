/**
 * SPEC-262 T-005 — Promo Code Effect Engine Tests
 *
 * Covers the four required test scenarios from the T-005 spec:
 *
 * 1. discount durationCycles=1 → finalAmount IDENTICAL to pre-SPEC-262 behavior (AC-4.1 regression lock)
 * 2. discount durationCycles=3 → remaining_cycles set to 2 after first apply
 * 3. comp → subscription status='comp', NO MP preapproval param emitted (AC-2.1)
 * 4. trial_extension at checkout → freeTrialDays populated from persisted extraDays (AC-3.2)
 *
 * Also tests:
 * - mapDbToPromoCode correctly maps the new extras-carril columns into the PromoCode DTO
 * - mapDbToPromoCode backward-compat: legacy rows (no effect columns) map cleanly
 *
 * @module test/billing/promo-code.effect-engine
 */

import type { PromoEffect } from '@repo/schemas';
import { PromoEffectKindEnum, ValueKindEnum } from '@repo/schemas';
import { type MockInstance, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculatePromoCodeEffect } from '../../src/services/billing/promo-code/effect-reducer.js';

// Mock @repo/db BEFORE any imports that use it.
// Must match exactly what promo-code.redemption.ts imports from '@repo/db'.
vi.mock('@repo/db', () => ({
    billingPromoCodes: { usedCount: 'usedCount', id: 'id' },
    billingPromoCodeUsage: {},
    billingSubscriptions: {},
    count: vi.fn(),
    eq: vi.fn(),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        _type: 'sql'
    })),
    getDb: vi.fn(),
    withTransaction: vi.fn()
}));

vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeByCode: vi.fn()
}));

import * as dbModule from '@repo/db';
import * as promoCrudModule from '../../src/services/billing/promo-code/promo-code.crud.js';
import { applyPromoCode } from '../../src/services/billing/promo-code/promo-code.redemption.js';

// mapDbToPromoCode is tested with the REAL implementation (not the mock).
// vi.importActual bypasses the vi.mock above for the specific module.
// We use a relaxed `(row: unknown) => unknown` signature here because tsc
// can't resolve the QZPayBillingPromoCode input constraint from within
// vi.importActual's generic in the test environment. The runtime value IS
// the real mapDbToPromoCode — the relaxed type is test-only.
// biome-ignore lint/suspicious/noExplicitAny: test-only relaxed cast for vi.importActual
let mapDbToPromoCode: (row: any) => unknown;

beforeAll(async () => {
    const crudModule = await vi.importActual<{
        mapDbToPromoCode: typeof import(
            '../../src/services/billing/promo-code/promo-code.crud.js'
        )['mapDbToPromoCode'];
    }>('../../src/services/billing/promo-code/promo-code.crud.js');
    mapDbToPromoCode = crudModule.mapDbToPromoCode;
});

const mockWithTransaction = dbModule.withTransaction as ReturnType<typeof vi.fn>;
const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;
const mockGetPromoCodeByCode = promoCrudModule.getPromoCodeByCode as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock SELECT ... FOR UPDATE chain that resolves to `rows`.
 * Matches the Drizzle chain: tx.select().from(...).where(...).for('update')
 */
function selectForUpdateMock<T>(rows: T[]): { select: ReturnType<typeof vi.fn> } {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue(rows)
                })
            })
        })
    };
}

/**
 * Build a mock TX with all the operations used inside redeemAndRecordInTx:
 * - select (FOR UPDATE lock)
 * - update (usedCount increment)
 * - insert (usage record)
 * - execute (raw SQL for remaining_cycles update — discount path only)
 */
function buildTxMock(lockedRow: {
    id: string;
    usedCount: number;
    maxUses: number | null;
    expiresAt: null | string;
}) {
    const executeMock = vi.fn().mockResolvedValue(undefined);

    return {
        ...selectForUpdateMock([lockedRow]),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([])
            })
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([])
        }),
        execute: executeMock
    };
}

/**
 * Build a PromoCode DTO with sensible defaults and the given overrides.
 * Matches the shape of PromoCode from promo-code.service.ts.
 */
function makePromoCode(overrides: Record<string, unknown> = {}) {
    return {
        id: 'pc-1',
        code: 'TEST10',
        type: 'percentage' as const,
        value: 10,
        active: true,
        expiresAt: null,
        timesRedeemed: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SPEC-262 T-005 — Effect Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ════════════════════════════════════════════════════════════════════════
    // 1. mapDbToPromoCode — effect column mapping (real implementation)
    // ════════════════════════════════════════════════════════════════════════

    describe('mapDbToPromoCode — extras-carril column mapping', () => {
        const baseRow = {
            id: 'pc-1',
            code: 'TEST',
            type: 'percentage',
            value: 30,
            active: true,
            expiresAt: null,
            startsAt: null,
            maxUses: null,
            maxUsesPerUser: null,
            usedCount: 0,
            config: null,
            validPlans: null,
            newCustomersOnly: false,
            combinable: false,
            createdAt: new Date('2024-01-01'),
            livemode: false
        };

        it('should map a discount effect row with value_kind="percentage" to a typed effect', () => {
            // Arrange
            const row = {
                ...baseRow,
                effect_kind: 'discount',
                value_kind: 'percentage',
                duration_cycles: 1,
                extra_days: null
            };

            // Act
            const result = mapDbToPromoCode(row) as Record<string, unknown>;

            // Assert
            expect(result.effect).toEqual({
                kind: 'discount',
                valueKind: 'percentage',
                value: 30,
                durationCycles: 1
            });
            // Legacy fields preserved (AC-4.3)
            expect(result.type).toBe('percentage');
            expect(result.value).toBe(30);
        });

        it('should map a discount effect row with value_kind="fixed" to a typed effect', () => {
            // Arrange
            const row = {
                ...baseRow,
                value: 500,
                effect_kind: 'discount',
                value_kind: 'fixed',
                duration_cycles: 3,
                extra_days: null
            };

            // Act
            const result = mapDbToPromoCode(row) as Record<string, unknown>;

            // Assert
            expect(result.effect).toEqual({
                kind: 'discount',
                valueKind: 'fixed',
                value: 500,
                durationCycles: 3
            });
        });

        it('should map a trial_extension effect row', () => {
            // Arrange
            const row = {
                ...baseRow,
                code: 'FREEMONTH',
                value: 0,
                effect_kind: 'trial_extension',
                value_kind: null,
                duration_cycles: null,
                extra_days: 30
            };

            // Act
            const result = mapDbToPromoCode(row) as Record<string, unknown>;

            // Assert
            expect(result.effect).toEqual({
                kind: 'trial_extension',
                extraDays: 30
            });
            expect(result.type).toBe('trial_extension');
        });

        it('should map a comp effect row', () => {
            // Arrange
            const row = {
                ...baseRow,
                code: 'HOSPEDA_FREE',
                value: 0,
                effect_kind: 'comp',
                value_kind: null,
                duration_cycles: null,
                extra_days: null
            };

            // Act
            const result = mapDbToPromoCode(row) as Record<string, unknown>;

            // Assert
            expect(result.effect).toEqual({ kind: 'comp' });
            expect(result.type).toBe('comp');
        });

        it('should return undefined effect for a discount row with no value_kind (not yet backfilled)', () => {
            // Arrange — effect_kind='discount' but value_kind=NULL (row before backfill migration)
            const row = {
                ...baseRow,
                effect_kind: 'discount',
                value_kind: null,
                duration_cycles: null,
                extra_days: null
            };

            // Act
            const result = mapDbToPromoCode(row) as Record<string, unknown>;

            // Assert — no effect, backward-compat type preserved
            expect(result.effect).toBeUndefined();
            expect(result.type).toBe('percentage');
            expect(result.value).toBe(30);
        });

        it('should return undefined effect for a fully legacy row with no SPEC-262 columns at all', () => {
            // Arrange — no effect columns (as if extras/018 not yet applied)
            const row = { ...baseRow };

            // Act
            const result = mapDbToPromoCode(row) as Record<string, unknown>;

            // Assert
            expect(result.effect).toBeUndefined();
            expect(result.type).toBe('percentage');
        });

        it('should return undefined effect for a trial_extension row with extra_days=0 (invalid)', () => {
            // Arrange
            const row = {
                ...baseRow,
                effect_kind: 'trial_extension',
                value_kind: null,
                duration_cycles: null,
                extra_days: 0
            };

            // Act
            const result = mapDbToPromoCode(row) as Record<string, unknown>;

            // Assert — parser rejects extra_days=0 as invalid
            expect(result.effect).toBeUndefined();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 2. applyPromoCode — discount durationCycles=1 regression lock (AC-4.1)
    // ════════════════════════════════════════════════════════════════════════

    describe('applyPromoCode — discount durationCycles=1 (AC-4.1 regression lock)', () => {
        it('should produce IDENTICAL finalAmount to pre-SPEC-262 for a legacy code (no effect)', async () => {
            // Arrange — legacy code with no `effect` field
            const promoCode = makePromoCode({
                code: 'BIENVENIDO30',
                type: 'percentage',
                value: 30
                // No `effect` — legacy code
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('BIENVENIDO30', 'cust-1', 10000);

            // Assert — 30% of 10000 = 3000 discount, finalAmount = 7000
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(3000);
                expect(result.data.finalAmount).toBe(7000);
                expect(result.data.originalAmount).toBe(10000);
                expect(result.data.effectKind).toBe('discount');
            }
        });

        it('should produce IDENTICAL finalAmount for a typed discount effect with durationCycles=1', async () => {
            // Arrange — new typed effect, same economics as legacy one-shot code
            const promoCode = makePromoCode({
                code: 'BIENVENIDO30',
                type: 'percentage',
                value: 30,
                effect: {
                    kind: 'discount',
                    valueKind: 'percentage',
                    value: 30,
                    durationCycles: 1
                }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            let capturedTxExecute: ReturnType<typeof vi.fn> | null = null;

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    capturedTxExecute = tx.execute;
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('BIENVENIDO30', 'cust-1', 10000, {
                subscriptionId: 'sub-abc'
            });

            // Assert — same economics as AC-4.1
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(3000);
                expect(result.data.finalAmount).toBe(7000);
                expect(result.data.originalAmount).toBe(10000);
                expect(result.data.effectKind).toBe('discount');
                if (result.data.effectKind === 'discount') {
                    // After first apply with durationCycles=1, remaining = 0 (exhausted)
                    expect(result.data.remainingCycles).toBe(0);
                }
            }

            // The tx.execute for remaining_cycles=0 was called (inside the transaction)
            expect(capturedTxExecute).not.toBeNull();
            expect(capturedTxExecute).toHaveBeenCalledTimes(1);
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 3. applyPromoCode — discount durationCycles=3 sets remaining to 2
    // ════════════════════════════════════════════════════════════════════════

    describe('applyPromoCode — discount durationCycles=3 (multi-cycle)', () => {
        it('should set promo_effect_remaining_cycles=2 after first apply when durationCycles=3', async () => {
            // Arrange
            const promoCode = makePromoCode({
                code: 'LANZAMIENTO50',
                type: 'percentage',
                value: 50,
                effect: {
                    kind: 'discount',
                    valueKind: 'percentage',
                    value: 50,
                    durationCycles: 3
                }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            let capturedTxExecute: ReturnType<typeof vi.fn> | null = null;

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    capturedTxExecute = tx.execute;
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('LANZAMIENTO50', 'cust-1', 10000, {
                subscriptionId: 'sub-xyz'
            });

            // Assert — discount computed correctly
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(5000); // 50% of 10000
                expect(result.data.finalAmount).toBe(5000);
                expect(result.data.effectKind).toBe('discount');
                if (result.data.effectKind === 'discount') {
                    // After first cycle consumed, remaining = 3 - 1 = 2
                    expect(result.data.remainingCycles).toBe(2);
                }
            }

            // The tx.execute for promo_effect_remaining_cycles was called
            expect(capturedTxExecute).not.toBeNull();
            expect(capturedTxExecute).toHaveBeenCalledTimes(1);

            // The SQL passed to tx.execute contains the remaining_cycles update
            // Cast via unknown to MockInstance — capturedTxExecute is non-null
            // because expect().not.toBeNull() above would have thrown otherwise.
            const executeMockInstance = capturedTxExecute as unknown as MockInstance;
            const executeArg = (executeMockInstance.mock.calls[0] as [unknown] | undefined)?.[0] as
                | { strings: TemplateStringsArray; values: unknown[] }
                | undefined;
            expect(executeArg).toBeDefined();
            const sqlTemplate = (executeArg?.strings ?? []).join('');
            expect(sqlTemplate).toContain('promo_effect_remaining_cycles');
            expect(sqlTemplate).toContain('billing_subscriptions');
            // The value 2 is passed as a bound parameter
            expect(executeArg?.values).toContain(2);
        });

        it('should set promo_effect_remaining_cycles=null for a forever discount (durationCycles=null)', async () => {
            // Arrange
            const promoCode = makePromoCode({
                code: 'FOREVER100',
                type: 'percentage',
                value: 100,
                effect: {
                    kind: 'discount',
                    valueKind: 'percentage',
                    value: 100,
                    durationCycles: null // forever
                }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            let capturedTxExecute: ReturnType<typeof vi.fn> | null = null;

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    capturedTxExecute = tx.execute;
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('FOREVER100', 'cust-1', 10000, {
                subscriptionId: 'sub-abc'
            });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.finalAmount).toBe(0); // 100% off
                expect(result.data.effectKind).toBe('discount');
                if (result.data.effectKind === 'discount') {
                    expect(result.data.remainingCycles).toBeNull(); // null = forever
                }
            }

            // The UPDATE for remaining_cycles=null was executed
            expect(capturedTxExecute).toHaveBeenCalledTimes(1);
            // Cast via unknown to MockInstance — non-null guaranteed by toHaveBeenCalledTimes(1)
            const executeMockInstanceForever = capturedTxExecute as unknown as MockInstance;
            const executeArg = (
                executeMockInstanceForever.mock.calls[0] as [unknown] | undefined
            )?.[0] as { strings: TemplateStringsArray; values: unknown[] } | undefined;
            const sqlTemplate = (executeArg?.strings ?? []).join('');
            expect(sqlTemplate).toContain('promo_effect_remaining_cycles');
            // null is passed as a bound parameter
            expect(executeArg?.values).toContain(null);
        });

        it('should NOT set remaining_cycles when no subscriptionId is provided (preview mode)', async () => {
            // Arrange
            const promoCode = makePromoCode({
                code: 'LANZAMIENTO50',
                type: 'percentage',
                value: 50,
                effect: {
                    kind: 'discount',
                    valueKind: 'percentage',
                    value: 50,
                    durationCycles: 3
                }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            let capturedTxExecute: ReturnType<typeof vi.fn> | null = null;

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    capturedTxExecute = tx.execute;
                    return fn(tx);
                }
            );

            // Act — no subscriptionId
            const result = await applyPromoCode('LANZAMIENTO50', 'cust-1', 10000);

            // Assert — success but no execute (no subscription to update)
            expect(result.success).toBe(true);
            expect(capturedTxExecute).not.toHaveBeenCalled();
            if (result.success) {
                expect(result.data.effectKind).toBe('discount');
                // remainingCycles not included when no subscriptionId
                if (result.data.effectKind === 'discount') {
                    expect(result.data.remainingCycles).toBeUndefined();
                }
            }
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 4. applyPromoCode — comp effect (AC-2.1)
    // ════════════════════════════════════════════════════════════════════════

    describe('applyPromoCode — comp effect (AC-2.1)', () => {
        it('should return discountAmount=0, finalAmount=0 and stamp status=comp on the subscription', async () => {
            // Arrange
            const promoCode = makePromoCode({
                code: 'HOSPEDA_FREE',
                type: 'comp',
                value: 0,
                effect: { kind: 'comp' }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            // The comp branch stamps status='comp' via tx.execute INSIDE the
            // transaction (atomic with the redeem — S-1 fix).
            let capturedTxExecute: ReturnType<typeof vi.fn> | null = null;

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    capturedTxExecute = tx.execute;
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('HOSPEDA_FREE', 'cust-1', 5000, {
                subscriptionId: 'sub-comp'
            });

            // Assert — AC-2.1: charge is 0
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.effectKind).toBe('comp');
                expect(result.data.discountAmount).toBe(0);
                expect(result.data.finalAmount).toBe(0);
                expect(result.data.originalAmount).toBe(5000);
            }

            // Assert — NO MP preapproval parameters are emitted by this function.
            // The caller MUST NOT create a MP preapproval for comp subscriptions (AC-2.1).
            // We verify this by checking the returned data has no preapproval/checkout fields.
            if (result.success) {
                expect('mpSubscriptionId' in result.data).toBe(false);
                expect('checkoutUrl' in result.data).toBe(false);
                expect('preapprovalId' in result.data).toBe(false);
            }

            // Assert — subscription status=comp stamped via tx.execute INSIDE the
            // transaction (atomic with redeem — S-1 fix).
            expect(capturedTxExecute).not.toBeNull();
            expect(capturedTxExecute).toHaveBeenCalledTimes(1);
            const executeMockInstance = capturedTxExecute as unknown as MockInstance;
            const executeArg = (executeMockInstance.mock.calls[0] as [unknown] | undefined)?.[0] as
                | { strings: TemplateStringsArray; values: unknown[] }
                | undefined;
            expect(executeArg).toBeDefined();
            const sqlTemplate = (executeArg?.strings ?? []).join('');
            expect(sqlTemplate).toContain('billing_subscriptions');
            expect(sqlTemplate).toContain('status');
            // The value 'comp' is passed as a bound parameter
            expect(executeArg?.values).toContain('comp');
        });

        it('should NOT stamp status=comp when no subscriptionId is provided (preview)', async () => {
            // Arrange — checkout preview, subscription not yet created
            const promoCode = makePromoCode({
                code: 'HOSPEDA_FREE',
                type: 'comp',
                value: 0,
                effect: { kind: 'comp' }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            const mockDbExecute = vi.fn().mockResolvedValue(undefined);
            mockGetDb.mockReturnValue({ execute: mockDbExecute });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    return fn(tx);
                }
            );

            // Act — no subscriptionId
            const result = await applyPromoCode('HOSPEDA_FREE', 'cust-1', 5000);

            // Assert — succeeds but no db.execute (nothing to stamp)
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.effectKind).toBe('comp');
                expect(result.data.finalAmount).toBe(0);
            }
            // getDb() was never called since subscriptionId is absent
            expect(mockDbExecute).not.toHaveBeenCalled();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 5. applyPromoCode — trial_extension effect (AC-3.2)
    // ════════════════════════════════════════════════════════════════════════

    describe('applyPromoCode — trial_extension effect (AC-3.2)', () => {
        it('should return extraDays from the PERSISTED DB effect for use as freeTrialDays at signup', async () => {
            // Arrange — persisted DB effect with extraDays=30
            const promoCode = makePromoCode({
                code: 'FREEMONTH',
                type: 'trial_extension',
                value: 0,
                effect: {
                    kind: 'trial_extension',
                    extraDays: 30 // from DB, not from @repo/billing config
                }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('FREEMONTH', 'cust-1', 0);

            // Assert — effectKind is trial_extension and extraDays reflects DB value (AC-3.2).
            // The caller translates extraDays → freeTrialDays on qzpay subscription create.
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.effectKind).toBe('trial_extension');
                if (result.data.effectKind === 'trial_extension') {
                    expect(result.data.extraDays).toBe(30);
                }
                // No monetary discount (AC-3.2 — trial extension is not a price change)
                expect(result.data.discountAmount).toBe(0);
            }
        });

        it('should return VALIDATION_ERROR when trial_extension code has extraDays=0 (invalid DB state)', async () => {
            // Arrange — code with trial_extension kind but no valid extraDays
            const promoCode = makePromoCode({
                code: 'BROKEN_TRIAL',
                type: 'trial_extension',
                value: 0,
                effect: {
                    kind: 'trial_extension',
                    extraDays: 0 // invalid
                }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            // Act
            const result = await applyPromoCode('BROKEN_TRIAL', 'cust-1', 0);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error?.code).toBe('VALIDATION_ERROR');
            }
        });

        it('should forward 60-day extension from DB — DB value not config-hardcoded 30 (AC-3.2)', async () => {
            // Arrange — a CUSTOM extension with 60 days that does NOT exist in @repo/billing config.
            // This validates AC-3.2: the source of truth is the DB, not the legacy config function.
            const promoCode = makePromoCode({
                code: 'SUMMER60',
                type: 'trial_extension',
                value: 0,
                effect: {
                    kind: 'trial_extension',
                    extraDays: 60 // custom value, only in DB
                }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('SUMMER60', 'cust-1', 0);

            // Assert — reads 60 from DB, NOT 30 from @repo/billing config (AC-3.2)
            expect(result.success).toBe(true);
            if (result.success && result.data.effectKind === 'trial_extension') {
                expect(result.data.extraDays).toBe(60);
            }
        });

        it('should NOT call getDb for a trial_extension code (only transaction used)', async () => {
            // Arrange
            const promoCode = makePromoCode({
                code: 'FREEMONTH',
                type: 'trial_extension',
                value: 0,
                effect: { kind: 'trial_extension', extraDays: 30 }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    return fn(tx);
                }
            );

            // Act
            await applyPromoCode('FREEMONTH', 'cust-1', 0, { subscriptionId: 'sub-abc' });

            // Assert — getDb() is only called for comp subscriptionId stamping, not trial_extension
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 6. calculatePromoCodeEffect — pure function tests (no mocking needed)
    // ════════════════════════════════════════════════════════════════════════

    describe('calculatePromoCodeEffect — pure function', () => {
        describe('comp effect', () => {
            it('should return comp-subscription mutation for comp kind', () => {
                // Arrange
                const effect: PromoEffect = { kind: PromoEffectKindEnum.COMP };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 5000);

                // Assert
                expect(mutation).toEqual({ type: 'comp-subscription' });
            });
        });

        describe('trial_extension effect', () => {
            it('should return extend-trial mutation with daysAdded=30', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                    extraDays: 30
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 0);

                // Assert
                expect(mutation).toEqual({ type: 'extend-trial', daysAdded: 30 });
            });

            it('should return extend-trial mutation with daysAdded=60', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                    extraDays: 60
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 0);

                // Assert
                expect(mutation).toEqual({ type: 'extend-trial', daysAdded: 60 });
            });
        });

        describe('discount effect — percentage', () => {
            it('should compute 30% of 10000 → discountAmount=3000, finalAmount=7000', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 30,
                    durationCycles: 1
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 10000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.discountAmount).toBe(3000);
                    expect(mutation.finalAmount).toBe(7000);
                }
            });

            it('should compute 100% of 10000 → discountAmount=10000, finalAmount=0, remainingCycles=null (forever)', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 100,
                    durationCycles: null
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 10000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.discountAmount).toBe(10000);
                    expect(mutation.finalAmount).toBe(0);
                    expect(mutation.remainingCycles).toBeNull();
                }
            });

            it('should compute 0% of any amount → discountAmount=0, finalAmount=originalAmount', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 0,
                    durationCycles: 1
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 5000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.discountAmount).toBe(0);
                    expect(mutation.finalAmount).toBe(5000);
                }
            });

            it('should use Math.floor for percentage discounts (33% of 1000 → 330, not 333)', () => {
                // Arrange — 1000 * 33 / 100 = 330.0 exactly (no rounding needed here)
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 33,
                    durationCycles: 1
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 1000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.discountAmount).toBe(330);
                    expect(mutation.finalAmount).toBe(670);
                }
            });

            it('should include roundingDelta when percentage produces a fractional centavo', () => {
                // Arrange — 1001 * 33 / 100 = 330.33 → floor=330, delta≈0.33
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 33,
                    durationCycles: 1
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 1001);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.discountAmount).toBe(330); // Math.floor(330.33)
                    expect(mutation.finalAmount).toBe(671);
                    expect(mutation.roundingDelta).toBeCloseTo(0.33, 2);
                }
            });
        });

        describe('discount effect — fixed', () => {
            it('should compute fixed 500 on 10000 → discountAmount=500, finalAmount=9500', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.FIXED,
                    value: 500,
                    durationCycles: 1
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 10000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.discountAmount).toBe(500);
                    expect(mutation.finalAmount).toBe(9500);
                }
            });

            it('should clamp fixed discount that exceeds original amount → discountAmount=originalAmount, finalAmount=0', () => {
                // Arrange — fixed 500 on original 300 (discount > price)
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.FIXED,
                    value: 500,
                    durationCycles: 1
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 300);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.discountAmount).toBe(300); // clamped to originalAmount
                    expect(mutation.finalAmount).toBe(0);
                }
            });

            it('should handle fixed discount equal to amount → finalAmount=0', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.FIXED,
                    value: 1000,
                    durationCycles: 1
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 1000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.discountAmount).toBe(1000);
                    expect(mutation.finalAmount).toBe(0);
                }
            });
        });

        describe('discount effect — remainingCycles', () => {
            it('should set remainingCycles=0 for durationCycles=1 (one-shot, exhausted)', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 20,
                    durationCycles: 1
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 10000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.remainingCycles).toBe(0);
                }
            });

            it('should set remainingCycles=2 for durationCycles=3 (first apply)', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 50,
                    durationCycles: 3
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 10000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.remainingCycles).toBe(2);
                }
            });

            it('should set remainingCycles=null for durationCycles=null (forever)', () => {
                // Arrange
                const effect: PromoEffect = {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 10,
                    durationCycles: null
                };

                // Act
                const mutation = calculatePromoCodeEffect(effect, 10000);

                // Assert
                expect(mutation.type).toBe('apply-discount');
                if (mutation.type === 'apply-discount') {
                    expect(mutation.remainingCycles).toBeNull();
                }
            });
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 7. applyPromoCode — state machine validation (AC-3.4)
    // ════════════════════════════════════════════════════════════════════════

    describe('applyPromoCode — state machine validation (AC-3.4)', () => {
        /**
         * Helper that sets up a promo code mock and a basic TX mock then calls applyPromoCode.
         */
        async function applyWithStatus(
            effect: Record<string, unknown>,
            subscriptionStatus: string | undefined,
            type: 'percentage' | 'fixed' | 'discount' | 'trial_extension' | 'comp' = 'percentage'
        ) {
            const promoCode = makePromoCode({
                code: 'TEST',
                type,
                value: 30,
                active: true,
                effect
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            const mockDbExecute = vi.fn().mockResolvedValue(undefined);
            mockGetDb.mockReturnValue({ execute: mockDbExecute });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    return fn(tx);
                }
            );

            return applyPromoCode('TEST', 'cust-1', 10000, {
                subscriptionId: 'sub-1',
                subscriptionStatus
            });
        }

        it('should reject a discount code on a cancelled subscription', async () => {
            // Arrange + Act
            const result = await applyWithStatus(
                { kind: 'discount', valueKind: 'percentage', value: 30, durationCycles: 1 },
                'cancelled',
                'percentage'
            );

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('VALIDATION_ERROR');
                expect(result.error.message).toContain('canceled or expired');
            }
        });

        it('should reject a trial_extension code on a cancelled subscription', async () => {
            // Arrange + Act
            const result = await applyWithStatus(
                { kind: 'trial_extension', extraDays: 30 },
                'cancelled',
                'trial_extension'
            );

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('VALIDATION_ERROR');
            }
        });

        it('should reject a comp code on an expired subscription', async () => {
            // Arrange + Act
            const result = await applyWithStatus({ kind: 'comp' }, 'expired', 'comp');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('VALIDATION_ERROR');
                expect(result.error.message).toContain('canceled or expired');
            }
        });

        it('should accept a trial_extension code on a trialing subscription', async () => {
            // Arrange + Act
            const result = await applyWithStatus(
                { kind: 'trial_extension', extraDays: 30 },
                'trialing',
                'trial_extension'
            );

            // Assert — state machine allows trial_extension on trialing
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.effectKind).toBe('trial_extension');
            }
        });

        it('should reject a trial_extension code on an active subscription (AC-3.4)', async () => {
            // Arrange + Act
            const result = await applyWithStatus(
                { kind: 'trial_extension', extraDays: 30 },
                'active',
                'trial_extension'
            );

            // Assert — trial extension cannot extend a non-trialing subscription
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('VALIDATION_ERROR');
                expect(result.error.message).toContain('trialing');
            }
        });

        it('should accept a discount code on an active subscription', async () => {
            // Arrange + Act
            const result = await applyWithStatus(
                { kind: 'discount', valueKind: 'percentage', value: 30, durationCycles: 1 },
                'active',
                'percentage'
            );

            // Assert — discount is valid for active subscriptions
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.effectKind).toBe('discount');
            }
        });

        it('should accept a trial_extension code when subscriptionStatus is undefined (signup path)', async () => {
            // Arrange + Act — no subscriptionStatus means this is checkout, no existing sub
            const result = await applyWithStatus(
                { kind: 'trial_extension', extraDays: 30 },
                undefined, // signup path
                'trial_extension'
            );

            // Assert — undefined status allows any effect kind (AC-3.4 signup exception)
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.effectKind).toBe('trial_extension');
            }
        });

        it('should accept a comp code on an active subscription (comp overrides billing)', async () => {
            // Arrange + Act
            const mockDbExecute = vi.fn().mockResolvedValue(undefined);
            mockGetDb.mockReturnValue({ execute: mockDbExecute });

            const promoCode = makePromoCode({
                code: 'HOSPEDA_FREE',
                type: 'comp',
                value: 0,
                active: true,
                effect: { kind: 'comp' }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({
                        id: 'pc-1',
                        usedCount: 0,
                        maxUses: null,
                        expiresAt: null
                    });
                    return fn(tx);
                }
            );

            const result = await applyPromoCode('HOSPEDA_FREE', 'cust-1', 5000, {
                subscriptionId: 'sub-active',
                subscriptionStatus: 'active'
            });

            // Assert — comp is always valid on non-cancelled/expired subscriptions
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.effectKind).toBe('comp');
                expect(result.data.finalAmount).toBe(0);
            }
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 8. applyPromoCode — validation edge cases
    // ════════════════════════════════════════════════════════════════════════

    describe('applyPromoCode — validation edge cases', () => {
        it('should return VALIDATION_ERROR when promo code is inactive (active=false)', async () => {
            // Arrange
            const promoCode = makePromoCode({ code: 'INACTIVE', active: false });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            // Act
            const result = await applyPromoCode('INACTIVE', 'cust-1', 10000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('VALIDATION_ERROR');
                expect(result.error.message).toContain('no longer active');
            }
        });

        it('should return VALIDATION_ERROR when promo code is expired (expiresAt in the past)', async () => {
            // Arrange
            const promoCode = makePromoCode({
                code: 'EXPIRED',
                expiresAt: '2000-01-01T00:00:00.000Z' // past
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            // Act
            const result = await applyPromoCode('EXPIRED', 'cust-1', 10000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('VALIDATION_ERROR');
                expect(result.error.message).toContain('expired');
            }
        });

        it('should return NOT_FOUND when promo code does not exist', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({ success: false, data: null });

            // Act
            const result = await applyPromoCode('NONEXISTENT', 'cust-1', 10000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('NOT_FOUND');
            }
        });

        it('should return VALIDATION_ERROR for trial_extension with extraDays=0 in DB', async () => {
            // Arrange — broken DB state: effect_kind='trial_extension' but extra_days=0
            const promoCode = makePromoCode({
                code: 'BROKEN',
                type: 'trial_extension',
                value: 0,
                effect: { kind: 'trial_extension', extraDays: 0 }
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promoCode });

            // Act
            const result = await applyPromoCode('BROKEN', 'cust-1', 0);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('VALIDATION_ERROR');
            }
        });
    });
});

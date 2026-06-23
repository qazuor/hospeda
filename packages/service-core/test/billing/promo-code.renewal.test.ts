/**
 * SPEC-262 T-007 — resolveRenewalPromoEffect Unit Tests
 *
 * Covers the multi-cycle discount renewal DECISION (service-core layer; no MP):
 *
 * Cycle-counter invariant (B1): promo_effect_remaining_cycles = "number of
 * discounted charges still owed". The webhook is the ONLY decrementer.
 * For durationCycles=3 the correct initial DB seed is remaining=3 (not 2),
 * because no charge happens at apply time on the existing-sub path.
 *
 * Tests:
 * 1. Webhook #1 (remaining=3 → 2): apply-discount (AC-1.5 first webhook)
 * 2. Webhook #2 (remaining=2 → 1): apply-discount (second webhook, still discounted)
 * 3. Webhook #3 / last cycle (remaining=1 → 0): restore-full, effect exhausted (AC-1.5 stop)
 * 4. End-to-end N=3: simulate 3 successful webhooks, assert EXACTLY 3 discounted + full on #4
 * 5. Forever (remaining=NULL, durationCycles=NULL): apply-discount, counter stays NULL (AC-2.2)
 * 6. Comp (status='comp'): action='comp', no amount, counter untouched (AC-2.1/2.2)
 * 7. No promo code linked: noop
 * 8. Already exhausted (remaining=0): noop
 * 9. Subscription not found: NOT_FOUND error
 * 10. persist=false: decision computed but counter NOT written
 * 11. Defensive branch (remaining=null, durationCycles set): restore-full + log.error (NIT)
 *
 * The DB layer is fully mocked — no real database is hit.
 *
 * @module test/billing/promo-code.renewal
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks that need to be referenced at mock-factory call sites.
// vi.hoisted() runs before all imports so the variable is initialized in time.
// ---------------------------------------------------------------------------
const { mockLoggerError } = vi.hoisted(() => ({
    mockLoggerError: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock @repo/db BEFORE importing the module under test.
// resolveRenewalPromoEffect uses getDb().execute(sql) → { rows }.
// ---------------------------------------------------------------------------
vi.mock('@repo/db', () => ({
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        _type: 'sql'
    })),
    getDb: vi.fn()
}));

// Mock the CRUD module so we control getPromoCodeById without a DB.
vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeById: vi.fn()
}));

// Mock @repo/logger so the defensive-branch NIT test can assert log.error was called.
// promo-code.renewal.ts uses createLogger('service-core:promo-code:renewal') and calls
// log.error(context, message) for the inconsistent-state case. Service-core must NOT
// import @sentry/node directly (missing dep: @sentry/opentelemetry).
vi.mock('@repo/logger', () => ({
    createLogger: vi.fn(() => ({
        error: mockLoggerError,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }))
}));

import * as dbModule from '@repo/db';
import * as promoCrudModule from '../../src/services/billing/promo-code/promo-code.crud.js';
import { resolveRenewalPromoEffect } from '../../src/services/billing/promo-code/promo-code.renewal.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;
const mockGetPromoCodeById = promoCrudModule.getPromoCodeById as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock `getDb()` whose `.execute(sql)` returns rows based on which
 * query is running. We discriminate by inspecting the interpolated values:
 * the subscription query carries the subscriptionId; the price query carries
 * the planId; the UPDATE carries the subscriptionId + remaining cycles.
 *
 * @param options.subRow - the subscription row to return for the SELECT.
 * @param options.unitAmount - the billing_prices.unit_amount (centavos).
 * @param options.executeSpy - optional spy to observe every execute call.
 */
function buildDbMock(options: {
    subRow: Record<string, unknown> | null;
    unitAmount?: number;
    executeSpy?: ReturnType<typeof vi.fn>;
}) {
    const { subRow, unitAmount, executeSpy } = options;
    const execute = executeSpy ?? vi.fn();

    execute.mockImplementation((query: { strings: TemplateStringsArray }) => {
        const text = query.strings.join(' ');
        if (text.includes('FROM billing_subscriptions') && text.includes('SELECT')) {
            return Promise.resolve({ rows: subRow ? [subRow] : [] });
        }
        if (text.includes('FROM billing_prices')) {
            return Promise.resolve({
                rows: unitAmount !== undefined ? [{ unit_amount: unitAmount }] : []
            });
        }
        // UPDATE billing_subscriptions ... promo_effect_remaining_cycles
        return Promise.resolve({ rows: [] });
    });

    return { execute };
}

/** Build a discount promo code DTO with the given duration. */
function discountCode(durationCycles: number | null) {
    return {
        success: true,
        data: {
            id: 'pc-1',
            code: 'LANZAMIENTO50',
            type: 'discount',
            value: 50,
            active: true,
            timesRedeemed: 0,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            effect: {
                kind: 'discount' as const,
                valueKind: 'percentage' as const,
                value: 50,
                durationCycles
            }
        }
    };
}

describe('resolveRenewalPromoEffect (SPEC-262 T-007)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // B1: Initial seed for existing-sub apply path is durationCycles (full N=3).
    // Webhook #1: remaining=3 → 2 (apply-discount).
    it('webhook #1 (remaining=3 → 2): apply-discount, counter decremented to 2', async () => {
        // Arrange
        const executeSpy = vi.fn();
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1',
                promo_code_id: 'pc-1',
                promo_effect_remaining_cycles: 3 // correct B1 seed = durationCycles
            },
            unitAmount: 10000,
            executeSpy
        });
        mockGetDb.mockReturnValue(db);
        mockGetPromoCodeById.mockResolvedValue(discountCode(3));

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('apply-discount');
        expect(result.data.remainingCyclesAfter).toBe(2);
        // 50% of 10000 = 5000 centavos → 50 major units
        expect(result.data.targetTransactionAmountCentavos).toBe(5000);
        expect(result.data.targetTransactionAmountMajor).toBe(50);
        // counter persisted to 2
        const updateCall = executeSpy.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect(updateCall).toBeDefined();
        expect((updateCall?.[0] as { values: unknown[] }).values).toContain(2);
    });

    it('webhook #2 (remaining=2 → 1): apply-discount, counter decremented to 1', async () => {
        // Arrange
        const executeSpy = vi.fn();
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1',
                promo_code_id: 'pc-1',
                promo_effect_remaining_cycles: 2
            },
            unitAmount: 10000,
            executeSpy
        });
        mockGetDb.mockReturnValue(db);
        mockGetPromoCodeById.mockResolvedValue(discountCode(3));

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('apply-discount');
        expect(result.data.remainingCyclesAfter).toBe(1);
        expect(result.data.targetTransactionAmountCentavos).toBe(5000);
        expect(result.data.targetTransactionAmountMajor).toBe(50);
        const updateCall = executeSpy.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect(updateCall).toBeDefined();
        expect((updateCall?.[0] as { values: unknown[] }).values).toContain(1);
    });

    it('webhook #3 / last cycle (remaining=1 → 0): restore-full, effect exhausted (AC-1.5 stop)', async () => {
        // Arrange
        const executeSpy = vi.fn();
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1',
                promo_code_id: 'pc-1',
                promo_effect_remaining_cycles: 1
            },
            unitAmount: 10000,
            executeSpy
        });
        mockGetDb.mockReturnValue(db);
        mockGetPromoCodeById.mockResolvedValue(discountCode(3));

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('restore-full');
        expect(result.data.remainingCyclesAfter).toBe(0);
        // restore to full price 10000 centavos → 100 major
        expect(result.data.targetTransactionAmountCentavos).toBe(10000);
        expect(result.data.targetTransactionAmountMajor).toBe(100);
        const updateCall = executeSpy.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect((updateCall?.[0] as { values: unknown[] }).values).toContain(0);
    });

    it('end-to-end N=3: exactly 3 discounted webhooks then full price on #4 (B1 invariant)', async () => {
        // Simulate the full lifecycle: seed=3, webhook1→2, webhook2→1, webhook3→restore-full, webhook4→noop.
        // This proves the invariant: N=3 → exactly 3 discounted charges, then full on #4.
        const UNIT_AMOUNT = 10000;
        const DURATION_CYCLES = 3;

        async function runWebhook(remaining: number) {
            const executeSpy = vi.fn();
            const db = buildDbMock({
                subRow: {
                    id: 'sub-e2e',
                    status: 'active',
                    plan_id: 'plan-1',
                    mp_subscription_id: 'mp-1',
                    promo_code_id: 'pc-1',
                    promo_effect_remaining_cycles: remaining
                },
                unitAmount: UNIT_AMOUNT,
                executeSpy
            });
            mockGetDb.mockReturnValue(db);
            mockGetPromoCodeById.mockResolvedValue(discountCode(DURATION_CYCLES));
            return resolveRenewalPromoEffect({ subscriptionId: 'sub-e2e' });
        }

        // Webhook 1: remaining=3 → apply-discount (2 remaining after)
        const w1 = await runWebhook(3);
        expect(w1.success && w1.data.action).toBe('apply-discount');
        expect(w1.success && w1.data.remainingCyclesAfter).toBe(2);

        // Webhook 2: remaining=2 → apply-discount (1 remaining after)
        const w2 = await runWebhook(2);
        expect(w2.success && w2.data.action).toBe('apply-discount');
        expect(w2.success && w2.data.remainingCyclesAfter).toBe(1);

        // Webhook 3: remaining=1 → restore-full (0 remaining = last discounted cycle)
        const w3 = await runWebhook(1);
        expect(w3.success && w3.data.action).toBe('restore-full');
        expect(w3.success && w3.data.remainingCyclesAfter).toBe(0);

        // Webhook 4: remaining=0 → noop (already exhausted)
        const w4 = await runWebhook(0);
        expect(w4.success && w4.data.action).toBe('noop');
    });

    it('forever (remaining=NULL, durationCycles=NULL): apply-discount, counter stays NULL (AC-2.2)', async () => {
        // Arrange
        const executeSpy = vi.fn();
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1',
                promo_code_id: 'pc-1',
                promo_effect_remaining_cycles: null
            },
            unitAmount: 10000,
            executeSpy
        });
        mockGetDb.mockReturnValue(db);
        mockGetPromoCodeById.mockResolvedValue(discountCode(null));

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('apply-discount');
        expect(result.data.remainingCyclesAfter).toBeNull();
        expect(result.data.targetTransactionAmountCentavos).toBe(5000);
        // No UPDATE should run for a forever discount (counter stays null).
        const updateCall = executeSpy.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect(updateCall).toBeUndefined();
    });

    it('comp (status=comp): action=comp, no MP amount, counter untouched (AC-2.1/2.2)', async () => {
        // Arrange
        const executeSpy = vi.fn();
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'comp',
                plan_id: 'plan-1',
                mp_subscription_id: null,
                promo_code_id: 'pc-1',
                promo_effect_remaining_cycles: null
            },
            executeSpy
        });
        mockGetDb.mockReturnValue(db);

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('comp');
        expect(result.data.targetTransactionAmountMajor).toBeUndefined();
        // The promo code lookup is never needed for a comp sub.
        expect(mockGetPromoCodeById).not.toHaveBeenCalled();
        // No UPDATE / price query for comp.
        const nonSelectCall = executeSpy.mock.calls.find((c) => {
            const t = (c[0] as { strings: TemplateStringsArray }).strings.join(' ');
            return t.includes('UPDATE') || t.includes('billing_prices');
        });
        expect(nonSelectCall).toBeUndefined();
    });

    it('no promo code linked: noop', async () => {
        // Arrange
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1',
                promo_code_id: null,
                promo_effect_remaining_cycles: null
            }
        });
        mockGetDb.mockReturnValue(db);

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('noop');
        expect(mockGetPromoCodeById).not.toHaveBeenCalled();
    });

    it('already exhausted (remaining=0): noop, no decrement', async () => {
        // Arrange
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1',
                promo_code_id: 'pc-1',
                promo_effect_remaining_cycles: 0
            },
            unitAmount: 10000
        });
        mockGetDb.mockReturnValue(db);
        mockGetPromoCodeById.mockResolvedValue(discountCode(3));

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('noop');
        expect(result.data.remainingCyclesAfter).toBe(0);
    });

    it('subscription not found: NOT_FOUND error', async () => {
        // Arrange
        const db = buildDbMock({ subRow: null });
        mockGetDb.mockReturnValue(db);

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'missing' });

        // Assert
        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected failure');
        expect(result.error.code).toBe('NOT_FOUND');
    });

    it('persist=false: decision computed but counter NOT written (safety-net preview)', async () => {
        // Arrange
        const executeSpy = vi.fn();
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1',
                promo_code_id: 'pc-1',
                promo_effect_remaining_cycles: 2
            },
            unitAmount: 10000,
            executeSpy
        });
        mockGetDb.mockReturnValue(db);
        mockGetPromoCodeById.mockResolvedValue(discountCode(3));

        // Act
        const result = await resolveRenewalPromoEffect({
            subscriptionId: 'sub-1',
            persist: false
        });

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('apply-discount');
        expect(result.data.remainingCyclesAfter).toBe(1);
        const updateCall = executeSpy.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect(updateCall).toBeUndefined();
    });

    it('defensive branch (remaining=null, durationCycles set): restore-full + log.error called (NIT)', async () => {
        // Arrange: DB has remaining=null but the promo code has durationCycles=3 (inconsistent state).
        // Expected: restore-full + log.error called with a descriptive message (observable via Sentry
        // log transport in apps/api — service-core must not import @sentry/node directly).
        const executeSpy = vi.fn();
        const db = buildDbMock({
            subRow: {
                id: 'sub-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1',
                promo_code_id: 'pc-1',
                promo_effect_remaining_cycles: null // inconsistent: should be 0 if exhausted
            },
            unitAmount: 10000,
            executeSpy
        });
        mockGetDb.mockReturnValue(db);
        mockGetPromoCodeById.mockResolvedValue(discountCode(3)); // durationCycles=3, NOT null

        // Act
        const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });

        // Assert: restore-full to prevent indefinite under-charging.
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.action).toBe('restore-full');
        expect(result.data.remainingCyclesAfter).toBe(0);
        expect(result.data.targetTransactionAmountCentavos).toBe(10000);
        // log.error must have been called — the inconsistency is observable via
        // the Sentry log transport in apps/api (no direct @sentry/node in service-core).
        expect(mockLoggerError).toHaveBeenCalledOnce();
        const logMsg = mockLoggerError.mock.calls[0]?.[1] as string;
        expect(logMsg).toContain('inconsistent state');
        // Counter written to 0 (persist=true by default).
        const updateCall = executeSpy.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect(updateCall).toBeDefined();
        expect((updateCall?.[0] as { values: unknown[] }).values).toContain(0);
    });
});

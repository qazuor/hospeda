/**
 * SPEC-262 T-006 — extendExistingSubscriptionTrial Unit Tests
 *
 * Covers all acceptance criteria for the trial-extension-on-existing-subscription
 * operation (AC-3.1, AC-3.4, AC-3.5) plus the usage-limit enforcement fix:
 *
 * 1. trialing sub → trial_end pushed by extraDays, usage row created (AC-3.1)
 * 2. active (non-trialing) sub → VALIDATION_ERROR, no state change (AC-3.4)
 *    — promo counter must NOT be touched
 * 3. annual sub in trial → trial_end pushed (AC-3.5 accept path)
 * 4. annual sub past trial (active) → VALIDATION_ERROR (AC-3.5 reject path)
 * 5. promo code whose effect is NOT trial_extension → typed error
 * 6. promo code at maxUses → PROMO_CODE_MAX_USES, trial_end NOT updated
 *    (redeemAndRecordUsage returns !success before the execute runs)
 *
 * The DB / model layer is fully mocked — no real database is hit.
 *
 * @module test/billing/promo-code.trial-extension
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @repo/db BEFORE importing any module that uses it.
// Must match exactly what promo-code.trial-extension.ts imports from '@repo/db'.
// ---------------------------------------------------------------------------
vi.mock('@repo/db', () => ({
    billingSubscriptions: {
        id: 'id',
        customerId: 'customerId',
        status: 'status',
        trialEnd: 'trialEnd',
        mpSubscriptionId: 'mpSubscriptionId'
    },
    billingPromoCodeUsage: { id: 'id' },
    eq: vi.fn(),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        _type: 'sql'
    })),
    getDb: vi.fn(),
    withTransaction: vi.fn()
}));

// Mock the CRUD module so we control getPromoCodeById without a DB
vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeById: vi.fn()
}));

// Mock the redemption module so we control redeemAndRecordUsage
vi.mock('../../src/services/billing/promo-code/promo-code.redemption.js', () => ({
    redeemAndRecordUsage: vi.fn()
}));

import * as dbModule from '@repo/db';
import * as promoCrudModule from '../../src/services/billing/promo-code/promo-code.crud.js';
import * as promoRedemptionModule from '../../src/services/billing/promo-code/promo-code.redemption.js';
import { extendExistingSubscriptionTrial } from '../../src/services/billing/promo-code/promo-code.trial-extension.js';

const mockWithTransaction = dbModule.withTransaction as ReturnType<typeof vi.fn>;
const mockGetPromoCodeById = promoCrudModule.getPromoCodeById as ReturnType<typeof vi.fn>;
const mockRedeemAndRecordUsage = promoRedemptionModule.redeemAndRecordUsage as ReturnType<
    typeof vi.fn
>;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock `tx` object with the chains used inside `extendExistingSubscriptionTrial`.
 *
 * Chains covered:
 * - tx.select().from(...).where(...).limit(1) → returns `subRows`
 * - tx.execute(sql`...`)                       → resolves void (tracked by executeFn)
 */
function buildTxMock(options: {
    subRows: unknown[];
    executeFn?: ReturnType<typeof vi.fn>;
}) {
    const { subRows, executeFn = vi.fn().mockResolvedValue(undefined) } = options;

    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(subRows)
                })
            })
        }),
        execute: executeFn
    };
}

/**
 * Build a successful `redeemAndRecordUsage` mock return value.
 */
function redeemSuccess(usageId = 'usage-1') {
    return {
        success: true,
        data: {
            promoCode: { id: 'pc-1', usedCount: 1 },
            usageRecord: { id: usageId }
        }
    };
}

/**
 * Build a failed `redeemAndRecordUsage` mock return value for max-uses exceeded.
 */
function redeemMaxUsesError() {
    return {
        success: false,
        error: {
            code: 'PROMO_CODE_MAX_USES',
            message: 'This promo code has reached its maximum number of uses'
        }
    };
}

/**
 * Build a PromoCode DTO with a trial_extension effect.
 */
function makeTrialExtensionPromoCode(extraDays = 30) {
    return {
        id: 'pc-trial-1',
        code: 'FREEMONTH',
        type: 'trial_extension' as const,
        value: 0,
        active: true,
        expiresAt: null,
        timesRedeemed: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        effect: {
            kind: 'trial_extension' as const,
            extraDays
        }
    };
}

/**
 * Build a PromoCode DTO with a discount effect (NOT trial_extension).
 */
function makeDiscountPromoCode() {
    return {
        id: 'pc-discount-1',
        code: 'SAVE30',
        type: 'percentage' as const,
        value: 30,
        active: true,
        expiresAt: null,
        timesRedeemed: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        effect: {
            kind: 'discount' as const,
            valueKind: 'percentage' as const,
            value: 30,
            durationCycles: 1 as number | null
        }
    };
}

/**
 * Build a subscription row representing a trialing monthly subscription.
 * `mpSubscriptionId` is set to indicate a live MercadoPago preapproval.
 */
function makeTrialingMonthlySub(trialEnd = new Date('2026-07-15T00:00:00.000Z')) {
    return {
        id: 'sub-monthly-1',
        customerId: 'cust-abc',
        status: 'trialing',
        trialEnd,
        mpSubscriptionId: 'mp-preapproval-abc'
    };
}

/**
 * Build a subscription row representing a trialing annual subscription.
 * `mpSubscriptionId` is null (one-time charge, no recurring preapproval).
 */
function makeTrialingAnnualSub(trialEnd = new Date('2026-07-15T00:00:00.000Z')) {
    return {
        id: 'sub-annual-1',
        customerId: 'cust-annual',
        status: 'trialing',
        trialEnd,
        mpSubscriptionId: null
    };
}

/**
 * Build a subscription row representing a non-trial (active) subscription.
 */
function makeActiveSub(mpSubscriptionId: string | null = 'mp-preapproval-xyz') {
    return {
        id: 'sub-active-1',
        customerId: 'cust-active',
        status: 'active',
        trialEnd: null,
        mpSubscriptionId
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SPEC-262 T-006 — extendExistingSubscriptionTrial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ════════════════════════════════════════════════════════════════════════
    // AC-3.1: trialing sub → trial_end pushed by extraDays, usage row created
    // ════════════════════════════════════════════════════════════════════════

    describe('AC-3.1 — trialing monthly subscription (happy path)', () => {
        it('should extend trial_end by extraDays and create a usage row', async () => {
            // Arrange
            const promoCode = makeTrialExtensionPromoCode(30);
            const trialEndBefore = new Date('2026-07-15T00:00:00.000Z');
            const sub = makeTrialingMonthlySub(trialEndBefore);

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });
            mockRedeemAndRecordUsage.mockResolvedValue(redeemSuccess('usage-1'));

            const executeFn = vi.fn().mockResolvedValue(undefined);

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub], executeFn });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;

            const expectedNewTrialEnd = new Date(trialEndBefore.getTime() + 30 * 86_400_000);
            expect(result.data.daysAdded).toBe(30);
            expect(result.data.newTrialEnd.getTime()).toBe(expectedNewTrialEnd.getTime());
            expect(result.data.subscriptionId).toBe('sub-monthly-1');
            expect(result.data.usageRecordId).toBe('usage-1');

            // trial_end UPDATE must have been called AFTER redemption succeeded
            expect(executeFn).toHaveBeenCalledOnce();
        });

        it('should call redeemAndRecordUsage with discountAmount=0 and subscription customerId (not actorId)', async () => {
            // Arrange — sub.customerId is 'cust-abc', actorId is 'admin-user-1'
            const promoCode = makeTrialExtensionPromoCode(30);
            const sub = makeTrialingMonthlySub();

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });
            mockRedeemAndRecordUsage.mockResolvedValue(redeemSuccess());

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub] });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1',
                livemode: true
            });

            // Assert
            expect(result.success).toBe(true);

            // redeemAndRecordUsage must have been called exactly once
            expect(mockRedeemAndRecordUsage).toHaveBeenCalledOnce();
            const redeemCall = mockRedeemAndRecordUsage.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;

            // customerId = subscription's customer, NOT actorId
            expect(redeemCall.customerId).toBe('cust-abc');
            expect(redeemCall.customerId).not.toBe('admin-user-1');

            // discountAmount must be 0 — no monetary discount for trial extensions
            expect(redeemCall.discountAmount).toBe(0);

            // subscriptionId must be passed for the usage record
            expect(redeemCall.subscriptionId).toBe('sub-monthly-1');

            // livemode must be forwarded
            expect(redeemCall.livemode).toBe(true);
        });

        it('should set mpReconciliationPending=true for monthly sub (live preapproval)', async () => {
            // Arrange
            const promoCode = makeTrialExtensionPromoCode(30);
            const sub = makeTrialingMonthlySub();

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });
            mockRedeemAndRecordUsage.mockResolvedValue(redeemSuccess());

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub] });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            // Monthly sub has a live MP preapproval → needs reconciliation
            expect(result.data.mpReconciliationPending).toBe(true);
        });

        it('should handle trial_end=null (no prior trial) by anchoring extension from now', async () => {
            // Arrange — subscription in trialing status but no trial_end set (edge case)
            const promoCode = makeTrialExtensionPromoCode(7);
            const sub = { ...makeTrialingMonthlySub(), trialEnd: null };

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });
            mockRedeemAndRecordUsage.mockResolvedValue(redeemSuccess());

            const beforeCall = Date.now();
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub] });
                    return fn(tx);
                }
            );
            const afterCallBound = Date.now() + 1000; // 1-second buffer

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert — newTrialEnd should be ~7 days from now (within 1s window)
            expect(result.success).toBe(true);
            if (!result.success) return;

            const expectedMinEnd = beforeCall + 7 * 86_400_000;
            const expectedMaxEnd = afterCallBound + 7 * 86_400_000;
            const actualEnd = result.data.newTrialEnd.getTime();

            expect(actualEnd).toBeGreaterThanOrEqual(expectedMinEnd);
            expect(actualEnd).toBeLessThanOrEqual(expectedMaxEnd);
            expect(result.data.daysAdded).toBe(7);
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // Usage limit enforcement: maxUses exceeded → trial_end NOT updated
    // ════════════════════════════════════════════════════════════════════════

    describe('Usage limit enforcement', () => {
        it('should return PROMO_CODE_MAX_USES and NOT update trial_end when code is exhausted', async () => {
            // Arrange — code at max uses
            const promoCode = makeTrialExtensionPromoCode(30);
            const sub = makeTrialingMonthlySub();

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });
            // redeemAndRecordUsage signals max uses exceeded
            mockRedeemAndRecordUsage.mockResolvedValue(redeemMaxUsesError());

            const executeFn = vi.fn();

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub], executeFn });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert — error propagated from redemption
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('PROMO_CODE_MAX_USES');

            // CRITICAL: trial_end UPDATE must NOT have been called
            expect(executeFn).not.toHaveBeenCalled();
        });

        it('should return PROMO_CODE_MAX_USES_PER_CUSTOMER and NOT update trial_end', async () => {
            // Arrange
            const promoCode = makeTrialExtensionPromoCode(30);
            const sub = makeTrialingMonthlySub();

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });
            mockRedeemAndRecordUsage.mockResolvedValue({
                success: false,
                error: {
                    code: 'PROMO_CODE_MAX_USES_PER_CUSTOMER',
                    message: 'You have already used this promo code the maximum number of times'
                }
            });

            const executeFn = vi.fn();

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub], executeFn });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('PROMO_CODE_MAX_USES_PER_CUSTOMER');
            expect(executeFn).not.toHaveBeenCalled();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // AC-3.4: active (non-trialing) sub → VALIDATION_ERROR, no state change
    // ════════════════════════════════════════════════════════════════════════

    describe('AC-3.4 — non-trialing subscription (rejection)', () => {
        it('should return VALIDATION_ERROR when subscription is active (not trialing)', async () => {
            // Arrange
            const promoCode = makeTrialExtensionPromoCode(30);
            const sub = makeActiveSub();

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });

            const executeFn = vi.fn();

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub], executeFn });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-active-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(result.error.message).toContain('trialing status');

            // No state change — execute must NOT have been called
            expect(executeFn).not.toHaveBeenCalled();
            // Promo counter must NOT have been touched
            expect(mockRedeemAndRecordUsage).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR when subscription is cancelled', async () => {
            // Arrange
            const promoCode = makeTrialExtensionPromoCode(30);
            const sub = { ...makeActiveSub(), status: 'cancelled', trialEnd: null };

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });

            const executeFn = vi.fn();

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub], executeFn });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-active-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(mockRedeemAndRecordUsage).not.toHaveBeenCalled();
        });

        it('should return NOT_FOUND when subscription does not exist', async () => {
            // Arrange
            const promoCode = makeTrialExtensionPromoCode(30);
            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });

            const executeFn = vi.fn();

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [], executeFn }); // empty → not found
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-missing',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
            expect(mockRedeemAndRecordUsage).not.toHaveBeenCalled();
            expect(executeFn).not.toHaveBeenCalled();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // AC-3.5: annual sub in trial → trial_end pushed (accept path)
    // ════════════════════════════════════════════════════════════════════════

    describe('AC-3.5 — annual subscription in trial (accept)', () => {
        it('should extend trial_end for an annual sub that is still trialing', async () => {
            // Arrange — annual sub: mpSubscriptionId is null (no MP preapproval)
            const promoCode = makeTrialExtensionPromoCode(30);
            const trialEndBefore = new Date('2026-07-20T00:00:00.000Z');
            const sub = makeTrialingAnnualSub(trialEndBefore);

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });
            mockRedeemAndRecordUsage.mockResolvedValue(redeemSuccess());

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub] });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-annual-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;

            const expectedNewTrialEnd = new Date(trialEndBefore.getTime() + 30 * 86_400_000);
            expect(result.data.newTrialEnd.getTime()).toBe(expectedNewTrialEnd.getTime());
            expect(result.data.daysAdded).toBe(30);

            // Annual sub → no MP preapproval to reconcile
            expect(result.data.mpReconciliationPending).toBe(false);
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // AC-3.5: annual sub past trial → VALIDATION_ERROR (reject path)
    // ════════════════════════════════════════════════════════════════════════

    describe('AC-3.5 — annual subscription past trial (reject)', () => {
        it('should return VALIDATION_ERROR for an annual sub that is active (past trial)', async () => {
            // Arrange — annual sub, already active (no trial)
            const promoCode = makeTrialExtensionPromoCode(30);
            const sub = makeActiveSub(null); // null mpSubscriptionId → annual

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });

            const executeFn = vi.fn();

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub], executeFn });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-annual-active',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            // Should mention annual context explicitly (never a silent no-op — AC-3.5)
            expect(result.error.message).toContain('trialing status');

            // No state change
            expect(executeFn).not.toHaveBeenCalled();
            expect(mockRedeemAndRecordUsage).not.toHaveBeenCalled();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // Promo code effect validation: non-trial-extension code → typed error
    // ════════════════════════════════════════════════════════════════════════

    describe('Promo code effect validation', () => {
        it('should return VALIDATION_ERROR when promo code effect is NOT trial_extension (discount)', async () => {
            // Arrange — discount code, not trial_extension
            const discountCode = makeDiscountPromoCode();
            mockGetPromoCodeById.mockResolvedValue({ success: true, data: discountCode });

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-discount-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(result.error.message).toContain('trial_extension');
            // Transaction and redemption should NOT have been opened
            expect(mockWithTransaction).not.toHaveBeenCalled();
            expect(mockRedeemAndRecordUsage).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR when promo code has a comp effect', async () => {
            // Arrange — comp code, not trial_extension
            const compCode = {
                id: 'pc-comp-1',
                code: 'HOSPEDA_FREE',
                type: 'comp' as const,
                value: 0,
                active: true,
                expiresAt: null,
                timesRedeemed: 0,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                effect: { kind: 'comp' as const }
            };
            mockGetPromoCodeById.mockResolvedValue({ success: true, data: compCode });

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-comp-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR when promo code has no effect field at all (legacy)', async () => {
            // Arrange — legacy code with no effect field
            const legacyCode = {
                id: 'pc-legacy-1',
                code: 'OLD30',
                type: 'percentage' as const,
                value: 30,
                active: true,
                expiresAt: null,
                timesRedeemed: 0,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
                // No `effect` field — legacy code
            };
            mockGetPromoCodeById.mockResolvedValue({ success: true, data: legacyCode });

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-legacy-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(result.error.message).toContain('trial_extension');
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should return NOT_FOUND when promo code does not exist', async () => {
            // Arrange
            mockGetPromoCodeById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Promo code not found' }
            });

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-missing',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // Date math precision
    // ════════════════════════════════════════════════════════════════════════

    describe('Date arithmetic precision', () => {
        it('should add exactly daysAdded * 86400000ms to trial_end', async () => {
            // Arrange
            const extraDays = 7;
            const promoCode = makeTrialExtensionPromoCode(extraDays);
            const trialEndBefore = new Date('2026-08-01T12:30:00.000Z');
            const sub = makeTrialingMonthlySub(trialEndBefore);

            mockGetPromoCodeById.mockResolvedValue({ success: true, data: promoCode });
            mockRedeemAndRecordUsage.mockResolvedValue(redeemSuccess());

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = buildTxMock({ subRows: [sub] });
                    return fn(tx);
                }
            );

            // Act
            const result = await extendExistingSubscriptionTrial({
                subscriptionId: 'sub-monthly-1',
                promoCodeId: 'pc-trial-1',
                actorId: 'admin-user-1'
            });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;

            const expectedMs = trialEndBefore.getTime() + extraDays * 86_400_000;
            expect(result.data.newTrialEnd.getTime()).toBe(expectedMs);
        });
    });
});

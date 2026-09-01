/**
 * HOS-1012 T-039 — `applyTrialExtensionToRunningTrial` seam unit tests.
 *
 * The seam is what turned the protected `/promo-codes/apply` `trial_extension`
 * branch from a projection into a real mutation. What it must guarantee:
 *
 * - A code applied while a Hospeda-owned trial is running reaches the real
 *   mutator (`extendExistingSubscriptionTrial`), which moves `trial_end` and
 *   writes the usage row, and the PERSISTED date is what comes back.
 * - A second application of the same code is refused — the mutator's
 *   per-customer limit error is propagated, never swallowed into a success.
 * - A code applied with NO trial running does nothing, says so
 *   (`NO_ACTIVE_TRIAL`), and — the part that matters — never reaches the
 *   mutator, so the code is not burnt and stays usable.
 *
 * The mutator itself is covered against a `mp_subscription_id IS NULL` trialing
 * row (the exact shape of a HOS-1012 Hospeda-owned trial) by
 * `packages/service-core/test/billing/promo-code.trial-extension.test.ts`
 * ("AC-3.5 — annual subscription in trial", plus the two usage-limit cases);
 * it is mocked here so these tests stay about the seam's own decisions.
 *
 * @module test/services/promo-trial-extension-apply.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (declared before importing the module under test).
// ---------------------------------------------------------------------------

/** Rows the customer's running-trial lookup resolves to. */
let trialLookupRows: Array<{ id: string }> = [];

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    orderBy: vi.fn(() => ({
                        limit: vi.fn(async () => trialLookupRows)
                    }))
                }))
            }))
        }))
    })),
    billingSubscriptions: {
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        createdAt: 'created_at'
    },
    and: vi.fn((...args: unknown[]) => ({ and: args })),
    desc: vi.fn((col: unknown) => ({ desc: col })),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val }))
}));

const getPromoCodeByCodeMock = vi.fn();
const extendExistingSubscriptionTrialMock = vi.fn();
vi.mock('@repo/service-core', () => ({
    getPromoCodeByCode: (...args: unknown[]) => getPromoCodeByCodeMock(...args),
    extendExistingSubscriptionTrial: (...args: unknown[]) =>
        extendExistingSubscriptionTrialMock(...args)
}));

import {
    applyTrialExtensionToRunningTrial,
    NO_ACTIVE_TRIAL_ERROR_CODE
} from '../../src/services/promo-trial-extension-apply.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BILLING_CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const TRIAL_SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';

/**
 * `LANZAMIENTO60` — the code live in production that adds 60 days on top of the
 * default 30 (the pair a real 90-day customer is holding).
 */
function makeTrialExtensionCode(overrides: Record<string, unknown> = {}) {
    return {
        id: 'pc-lanzamiento60',
        code: 'LANZAMIENTO60',
        active: true,
        expiresAt: undefined,
        effect: { kind: 'trial_extension', extraDays: 60 },
        ...overrides
    };
}

/** The `trial_end` the mutator reports as PERSISTED on the row. */
const PERSISTED_TRIAL_END = new Date('2026-11-15T10:20:30.000Z');

function mutatorSuccess() {
    return {
        success: true,
        data: {
            subscriptionId: TRIAL_SUBSCRIPTION_ID,
            newTrialEnd: PERSISTED_TRIAL_END,
            daysAdded: 60,
            mpReconciliationPending: false,
            usageRecordId: 'usage-row-1'
        }
    };
}

describe('applyTrialExtensionToRunningTrial (HOS-1012 T-039)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        trialLookupRows = [{ id: TRIAL_SUBSCRIPTION_ID }];
        getPromoCodeByCodeMock.mockResolvedValue({ success: true, data: makeTrialExtensionCode() });
        extendExistingSubscriptionTrialMock.mockResolvedValue(mutatorSuccess());
    });

    describe('a code applied while a local trial is running', () => {
        it('reaches the real mutator and returns the PERSISTED trial_end', async () => {
            // Act
            const result = await applyTrialExtensionToRunningTrial({
                code: 'lanzamiento60',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });

            // Assert — the mutation ran, on the trial the lookup resolved.
            expect(extendExistingSubscriptionTrialMock).toHaveBeenCalledTimes(1);
            expect(extendExistingSubscriptionTrialMock).toHaveBeenCalledWith({
                subscriptionId: TRIAL_SUBSCRIPTION_ID,
                promoCodeId: 'pc-lanzamiento60',
                actorId: ACTOR_ID,
                livemode: false
            });

            expect(result.success).toBe(true);
            if (!result.success) return;
            // The date is read back from the mutation, not projected from now.
            expect(result.data.newTrialEnd.toISOString()).toBe(PERSISTED_TRIAL_END.toISOString());
            expect(result.data.daysAdded).toBe(60);
            // The usage row the mutator wrote in the same transaction.
            expect(result.data.usageRecordId).toBe('usage-row-1');
        });

        it('normalizes the typed code to upper case before looking it up', async () => {
            await applyTrialExtensionToRunningTrial({
                code: 'freemonth',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });

            expect(getPromoCodeByCodeMock).toHaveBeenCalledWith('FREEMONTH');
        });

        it('uses an explicitly supplied subscriptionId instead of the lookup', async () => {
            const explicitId = '44444444-4444-4444-8444-444444444444';

            await applyTrialExtensionToRunningTrial({
                code: 'FREEMONTH',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID,
                subscriptionId: explicitId
            });

            expect(extendExistingSubscriptionTrialMock).toHaveBeenCalledWith(
                expect.objectContaining({ subscriptionId: explicitId })
            );
        });
    });

    describe('a second application of the same code', () => {
        it('is refused with the per-customer limit error, never a partial success', async () => {
            // Arrange — first application succeeds.
            const first = await applyTrialExtensionToRunningTrial({
                code: 'LANZAMIENTO60',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });
            expect(first.success).toBe(true);

            // The mutator's atomic redeem re-validates the limits inside the row
            // lock, so the SECOND attempt comes back refused and `trial_end` is
            // never touched (proved in the service-core suite).
            extendExistingSubscriptionTrialMock.mockResolvedValue({
                success: false,
                error: {
                    code: 'PROMO_CODE_MAX_USES_PER_CUSTOMER',
                    message: 'You have already used this promo code'
                }
            });

            // Act
            const second = await applyTrialExtensionToRunningTrial({
                code: 'LANZAMIENTO60',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });

            // Assert
            expect(second.success).toBe(false);
            if (second.success) return;
            expect(second.error.code).toBe('PROMO_CODE_MAX_USES_PER_CUSTOMER');
        });
    });

    describe('a code applied with no trial running', () => {
        it('says so and never calls the mutator, so the code is not burnt', async () => {
            // Arrange — the customer holds no `trialing` subscription.
            trialLookupRows = [];

            // Act
            const result = await applyTrialExtensionToRunningTrial({
                code: 'FREEMONTH',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });

            // Assert — typed refusal, and nothing redeemed.
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe(NO_ACTIVE_TRIAL_ERROR_CODE);
            expect(result.error.message).toContain('not used');
            expect(extendExistingSubscriptionTrialMock).not.toHaveBeenCalled();
        });
    });

    describe('code-level refusals happen before anything is redeemed', () => {
        it('returns NOT_FOUND for an unknown code without calling the mutator', async () => {
            getPromoCodeByCodeMock.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'nope' }
            });

            const result = await applyTrialExtensionToRunningTrial({
                code: 'DOESNOTEXIST',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
            expect(extendExistingSubscriptionTrialMock).not.toHaveBeenCalled();
        });

        it('refuses an inactive code without calling the mutator', async () => {
            getPromoCodeByCodeMock.mockResolvedValue({
                success: true,
                data: makeTrialExtensionCode({ active: false })
            });

            const result = await applyTrialExtensionToRunningTrial({
                code: 'FREEMONTH',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(extendExistingSubscriptionTrialMock).not.toHaveBeenCalled();
        });

        it('refuses an expired code without calling the mutator', async () => {
            getPromoCodeByCodeMock.mockResolvedValue({
                success: true,
                data: makeTrialExtensionCode({ expiresAt: '2020-01-01T00:00:00.000Z' })
            });

            const result = await applyTrialExtensionToRunningTrial({
                code: 'FREEMONTH',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(extendExistingSubscriptionTrialMock).not.toHaveBeenCalled();
        });

        it('refuses a code whose effect is not trial_extension', async () => {
            getPromoCodeByCodeMock.mockResolvedValue({
                success: true,
                data: makeTrialExtensionCode({
                    effect: { kind: 'discount', valueKind: 'percentage', value: 20 }
                })
            });

            const result = await applyTrialExtensionToRunningTrial({
                code: 'SAVE20',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            });

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(extendExistingSubscriptionTrialMock).not.toHaveBeenCalled();
        });
    });
});

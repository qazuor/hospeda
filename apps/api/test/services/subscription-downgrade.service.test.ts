/**
 * Unit tests for the subscription-downgrade service (SPEC-141 D7).
 *
 * Coverage:
 * - Happy path: writes a `QZPayScheduledPlanChange` with the right
 *   shape and applyAt = sub.currentPeriodEnd.
 * - `replacedPriorSchedule` flag: true when an existing pending
 *   schedule is overwritten, false otherwise (no schedule, or terminal
 *   status like applied/cancelled/failed).
 * - Error variants: SUBSCRIPTION_NOT_FOUND, SAME_PLAN, PLAN_NOT_FOUND
 *   (current and target), NO_MATCHING_PRICE (current and target),
 *   NOT_A_DOWNGRADE defensive guard.
 * - `clearPendingScheduledPlanChange`: clears when pending, no-op when
 *   already cleared / terminal status / subscription missing.
 *
 * No HTTP context required: the service is framework-agnostic. The
 * billing instance is structurally mocked.
 *
 * @module test/services/subscription-downgrade.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SubscriptionDowngradeError,
    clearPendingScheduledPlanChange,
    scheduleSubscriptionDowngrade
} from '../../src/services/subscription-downgrade.service';

// ---------------------------------------------------------------------------
// Constants + helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const SUB_ID = '11111111-1111-4111-8111-111111111111';
const CURRENT_PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const TARGET_PLAN_ID = '00000000-0000-4000-8000-0000000000bb';
const TARGET_PRICE_ID = 'price_basic_monthly';

const PERIOD_START = new Date('2026-06-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-07-01T00:00:00.000Z');
const HALFWAY = new Date('2026-06-16T00:00:00.000Z');

interface SubFixtureOpts {
    planId?: string;
    scheduledPlanChange?: {
        status: 'pending' | 'applied' | 'cancelled' | 'failed';
        newPlanId?: string;
    } | null;
}

function makeSub(opts: SubFixtureOpts = {}) {
    return {
        id: SUB_ID,
        customerId: CUSTOMER_ID,
        planId: opts.planId ?? CURRENT_PLAN_ID,
        status: 'active' as const,
        currentPeriodStart: PERIOD_START,
        currentPeriodEnd: PERIOD_END,
        providerSubscriptionIds: { mercadopago: 'mp-pre-xyz' },
        scheduledPlanChange:
            opts.scheduledPlanChange === undefined
                ? null
                : opts.scheduledPlanChange === null
                  ? null
                  : {
                        newPlanId: opts.scheduledPlanChange.newPlanId ?? TARGET_PLAN_ID,
                        newPriceId: TARGET_PRICE_ID,
                        targetTransactionAmountMajor: 5_000,
                        applyAt: PERIOD_END.toISOString(),
                        requestedAt: PERIOD_START.toISOString(),
                        status: opts.scheduledPlanChange.status,
                        attemptCount: 0
                    }
    };
}

interface BillingMockOpts {
    sub?: ReturnType<typeof makeSub> | null;
    currentPlan?: { id: string; prices: unknown[] } | null;
    targetPlan?: { id: string; prices: unknown[] } | null;
}

function priceWith(overrides: {
    id?: string;
    unitAmount: number;
    active?: boolean;
    billingInterval?: string;
    intervalCount?: number;
}) {
    return {
        id: overrides.id ?? 'price-default',
        billingInterval: overrides.billingInterval ?? 'month',
        intervalCount: overrides.intervalCount ?? 1,
        unitAmount: overrides.unitAmount,
        active: overrides.active ?? true
    };
}

function createBillingMock(opts: BillingMockOpts = {}) {
    const sub = opts.sub === undefined ? makeSub() : opts.sub;
    const currentPlan =
        opts.currentPlan === undefined
            ? {
                  id: CURRENT_PLAN_ID,
                  prices: [priceWith({ id: 'price_pro_monthly', unitAmount: 15_000_000 })]
              }
            : opts.currentPlan;
    const targetPlan =
        opts.targetPlan === undefined
            ? {
                  id: TARGET_PLAN_ID,
                  prices: [priceWith({ id: TARGET_PRICE_ID, unitAmount: 5_000_000 })]
              }
            : opts.targetPlan;

    const planMap = new Map<string, typeof currentPlan>();
    if (currentPlan) planMap.set(currentPlan.id, currentPlan);
    if (targetPlan && targetPlan.id !== currentPlan?.id) planMap.set(targetPlan.id, targetPlan);

    return {
        subscriptions: {
            get: vi.fn().mockResolvedValue(sub),
            update: vi.fn().mockResolvedValue(sub) // returns the updated sub; tests only assert on the input
        },
        plans: {
            get: vi.fn((id: string) => Promise.resolve(planMap.get(id) ?? null))
        }
    };
}

// ---------------------------------------------------------------------------
// scheduleSubscriptionDowngrade
// ---------------------------------------------------------------------------

describe('scheduleSubscriptionDowngrade', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes a pending scheduled change with applyAt = sub.currentPeriodEnd', async () => {
        const billing = createBillingMock();

        const result = await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            requestedBy: 'user_42',
            now: HALFWAY
        });

        expect(result.subscriptionId).toBe(SUB_ID);
        expect(result.previousPlanId).toBe(CURRENT_PLAN_ID);
        expect(result.newPlanId).toBe(TARGET_PLAN_ID);
        expect(result.applyAt).toBe(PERIOD_END.toISOString());
        expect(result.replacedPriorSchedule).toBe(false);

        expect(billing.subscriptions.update).toHaveBeenCalledOnce();
        const [updateId, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        expect(updateId).toBe(SUB_ID);
        const scheduled = updateInput.scheduledPlanChange as Record<string, unknown>;
        expect(scheduled).toMatchObject({
            newPlanId: TARGET_PLAN_ID,
            newPriceId: TARGET_PRICE_ID,
            targetTransactionAmountMajor: 50_000, // 5_000_000 centavos / 100
            applyAt: PERIOD_END.toISOString(),
            requestedAt: HALFWAY.toISOString(),
            requestedBy: 'user_42',
            status: 'pending',
            attemptCount: 0
        });
        const metadata = scheduled.metadata as Record<string, unknown>;
        expect(metadata.source).toBe('plan-change-downgrade');
        expect(metadata.previousPlanId).toBe(CURRENT_PLAN_ID);
    });

    it('omits requestedBy when not provided', async () => {
        const billing = createBillingMock();

        await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY
        });

        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        const scheduled = updateInput.scheduledPlanChange as Record<string, unknown>;
        expect(scheduled.requestedBy).toBeUndefined();
    });

    it('flags replacedPriorSchedule=true when an existing pending schedule is overwritten', async () => {
        const billing = createBillingMock({
            sub: makeSub({
                scheduledPlanChange: { status: 'pending', newPlanId: 'plan_some_other' }
            })
        });

        const result = await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY
        });

        expect(result.replacedPriorSchedule).toBe(true);
        expect(billing.subscriptions.update).toHaveBeenCalledOnce();
    });

    it('keeps replacedPriorSchedule=false when existing schedule is in a terminal status', async () => {
        const billing = createBillingMock({
            sub: makeSub({ scheduledPlanChange: { status: 'applied' } })
        });

        const result = await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY
        });

        expect(result.replacedPriorSchedule).toBe(false);
    });

    it('throws SUBSCRIPTION_NOT_FOUND when the active sub is missing', async () => {
        const billing = createBillingMock({ sub: null });

        await expect(
            scheduleSubscriptionDowngrade({
                currentSubscriptionId: 'missing',
                newPlanId: TARGET_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'SUBSCRIPTION_NOT_FOUND' });
    });

    it('throws SAME_PLAN when newPlanId equals the current planId', async () => {
        const billing = createBillingMock();

        await expect(
            scheduleSubscriptionDowngrade({
                currentSubscriptionId: SUB_ID,
                newPlanId: CURRENT_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'SAME_PLAN' });
    });

    it('throws PLAN_NOT_FOUND when the current plan does not exist', async () => {
        const billing = createBillingMock({ currentPlan: null });

        await expect(
            scheduleSubscriptionDowngrade({
                currentSubscriptionId: SUB_ID,
                newPlanId: TARGET_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });

    it('throws PLAN_NOT_FOUND when the target plan does not exist', async () => {
        const billing = createBillingMock({ targetPlan: null });

        await expect(
            scheduleSubscriptionDowngrade({
                currentSubscriptionId: SUB_ID,
                newPlanId: TARGET_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });

    it('throws NO_MATCHING_PRICE when the current plan has no active price for the interval', async () => {
        const billing = createBillingMock({
            currentPlan: {
                id: CURRENT_PLAN_ID,
                prices: [
                    priceWith({
                        id: 'annual_only',
                        unitAmount: 15_000_000,
                        billingInterval: 'year'
                    })
                ]
            }
        });

        await expect(
            scheduleSubscriptionDowngrade({
                currentSubscriptionId: SUB_ID,
                newPlanId: TARGET_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'NO_MATCHING_PRICE' });
    });

    it('throws NOT_A_DOWNGRADE defensive guard when target price >= current', async () => {
        const billing = createBillingMock({
            currentPlan: {
                id: CURRENT_PLAN_ID,
                prices: [priceWith({ id: 'cur', unitAmount: 5_000_000 })]
            },
            targetPlan: {
                id: TARGET_PLAN_ID,
                prices: [priceWith({ id: TARGET_PRICE_ID, unitAmount: 15_000_000 })] // higher
            }
        });

        await expect(
            scheduleSubscriptionDowngrade({
                currentSubscriptionId: SUB_ID,
                newPlanId: TARGET_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'NOT_A_DOWNGRADE' });
        expect(billing.subscriptions.update).not.toHaveBeenCalled();
    });

    it('throws NOT_A_DOWNGRADE when prices are equal (no real change in $$)', async () => {
        const billing = createBillingMock({
            currentPlan: {
                id: CURRENT_PLAN_ID,
                prices: [priceWith({ id: 'cur', unitAmount: 10_000_000 })]
            },
            targetPlan: {
                id: TARGET_PLAN_ID,
                prices: [priceWith({ id: TARGET_PRICE_ID, unitAmount: 10_000_000 })]
            }
        });

        await expect(
            scheduleSubscriptionDowngrade({
                currentSubscriptionId: SUB_ID,
                newPlanId: TARGET_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                now: HALFWAY
            })
        ).rejects.toMatchObject({ code: 'NOT_A_DOWNGRADE' });
    });

    it('error instances carry both name and code for discrimination', () => {
        const err = new SubscriptionDowngradeError('SAME_PLAN', 'same');
        expect(err).toBeInstanceOf(SubscriptionDowngradeError);
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('SubscriptionDowngradeError');
        expect(err.code).toBe('SAME_PLAN');
    });
});

// ---------------------------------------------------------------------------
// clearPendingScheduledPlanChange
// ---------------------------------------------------------------------------

describe('clearPendingScheduledPlanChange', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clears the field when a pending schedule exists', async () => {
        const billing = createBillingMock({
            sub: makeSub({ scheduledPlanChange: { status: 'pending' } })
        });

        const result = await clearPendingScheduledPlanChange(
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing as any,
            SUB_ID
        );

        expect(result.cleared).toBe(true);
        expect(billing.subscriptions.update).toHaveBeenCalledOnce();
        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        expect(updateInput.scheduledPlanChange).toBeNull();
    });

    it('no-op when no scheduled change exists', async () => {
        const billing = createBillingMock({ sub: makeSub({ scheduledPlanChange: null }) });

        const result = await clearPendingScheduledPlanChange(
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing as any,
            SUB_ID
        );

        expect(result.cleared).toBe(false);
        expect(billing.subscriptions.update).not.toHaveBeenCalled();
    });

    it('no-op when scheduled change is in a terminal status (applied)', async () => {
        const billing = createBillingMock({
            sub: makeSub({ scheduledPlanChange: { status: 'applied' } })
        });

        const result = await clearPendingScheduledPlanChange(
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing as any,
            SUB_ID
        );

        expect(result.cleared).toBe(false);
        expect(billing.subscriptions.update).not.toHaveBeenCalled();
    });

    it('no-op when the subscription does not exist', async () => {
        const billing = createBillingMock({ sub: null });

        const result = await clearPendingScheduledPlanChange(
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing as any,
            'missing'
        );

        expect(result.cleared).toBe(false);
        expect(billing.subscriptions.update).not.toHaveBeenCalled();
    });
});

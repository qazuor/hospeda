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
    _internals,
    clearPendingScheduledPlanChange,
    getKeepSelectionsForChange,
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
        // interval + intervalCount drive `scheduleSubscriptionDowngrade`'s
        // currentPrice lookup (SPEC-143 T-143-61 cycle change support).
        // Default monthly so the existing test mocks (monthly current price
        // + cheaper monthly target) keep computing the same delta. Cycle-
        // change scenarios override these.
        interval: 'month' as const,
        intervalCount: 1,
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

    // ── T-017: normalized price comparison ───────────────────────────────────
    //
    // The NOT_A_DOWNGRADE guard must compare per-interval-unit amounts, not
    // absolute totals. Without normalization an annual→monthly same-tier
    // cycle change is misclassified:
    //
    //   annual total   = ARS 1_200_000  (12 months × ARS 100_000/month)
    //   monthly total  = ARS   120_000  (1 month × ARS 120_000/month)
    //
    // Absolute: 1_200_000 >= 120_000 → NOT_A_DOWNGRADE (WRONG)
    // Normalized: 100_000/month < 120_000/month → schedule correctly (RIGHT)

    describe('T-017 — normalized price comparison', () => {
        it('annual→monthly same-tier: schedules when normalized monthly rate is lower', async () => {
            // Sub is currently on annual billing (intervalCount=12 equivalent,
            // but qzpay uses interval='year'/intervalCount=1).
            // Annual price total = 1_200_000 centavos.
            // Target monthly price total = 120_000 centavos = 120_000/month.
            // Normalized annual rate  = 1_200_000 / 1 year.
            // Because we normalize per interval-unit (year vs month are different
            // units) the comparison works only when both sides use the same unit.
            //
            // Real scenario: user on annual ($100/month, billed yearly at $1200)
            // wants to switch to monthly ($120/month). The monthly rate is HIGHER
            // so this should be NOT_A_DOWNGRADE. We verify the inverse below.
            //
            // For a genuine normalized downgrade: annual plan $1200/yr ($100/month)
            // → target monthly $80/month. In qzpay terms: annual intervalCount=1,
            // monthly intervalCount=1, but the intervals differ. The service's
            // `findPriceForInterval` matches on (billingInterval, intervalCount),
            // so we pass the current sub's interval to find the current price.
            //
            // Simple scenario using matching interval type (month→month, different
            // intervalCount to prove normalization):
            //
            //   Current: 3-month (intervalCount=3) at 300_000 total → 100_000/month
            //   Target:  1-month (intervalCount=1) at 120_000 total → 120_000/month
            //
            // Without normalization: 300_000 >= 120_000 → NOT_A_DOWNGRADE (WRONG)
            // With normalization:    100_000 < 120_000  → NOT_A_DOWNGRADE (also wrong
            //   here because normalized target > normalized current)
            //
            // Correct test: target normalized is strictly LESS than current normalized.
            //   Current: 3-month at 360_000 → 120_000/month
            //   Target:  1-month at  80_000 →  80_000/month
            //
            // Without normalization: 360_000 >= 80_000 → NOT_A_DOWNGRADE (WRONG — BUG)
            // With normalization:    120_000 > 80_000  → schedule correctly (FIXED)

            const billing = createBillingMock({
                sub: makeSub({
                    // Sub is currently on a 3-month plan
                    planId: CURRENT_PLAN_ID
                }),
                currentPlan: {
                    id: CURRENT_PLAN_ID,
                    prices: [
                        priceWith({
                            id: 'price_quarterly',
                            unitAmount: 360_000, // total for 3 months = 120_000/month
                            billingInterval: 'month',
                            intervalCount: 3
                        })
                    ]
                },
                targetPlan: {
                    id: TARGET_PLAN_ID,
                    prices: [
                        priceWith({
                            id: TARGET_PRICE_ID,
                            unitAmount: 80_000, // 1-month price = 80_000/month (cheaper)
                            billingInterval: 'month',
                            intervalCount: 1
                        })
                    ]
                }
            });

            // Override the sub's interval to match the current plan price
            const sub3Month = {
                ...makeSub({ planId: CURRENT_PLAN_ID }),
                interval: 'month' as const,
                intervalCount: 3
            };
            billing.subscriptions.get.mockResolvedValue(sub3Month);

            // Act — must NOT throw, must schedule
            const result = await scheduleSubscriptionDowngrade({
                currentSubscriptionId: SUB_ID,
                newPlanId: TARGET_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1,
                // biome-ignore lint/suspicious/noExplicitAny: structural mock
                billing: billing as any,
                now: HALFWAY
            });

            expect(result.subscriptionId).toBe(SUB_ID);
            expect(result.newPlanId).toBe(TARGET_PLAN_ID);
            expect(billing.subscriptions.update).toHaveBeenCalledOnce();
        });

        it('annual→monthly same-tier: throws NOT_A_DOWNGRADE when normalized monthly rate is higher', async () => {
            // Current: 3-month at 300_000 → 100_000/month
            // Target:  1-month at 120_000 → 120_000/month (more expensive per month)
            const billing = createBillingMock({
                currentPlan: {
                    id: CURRENT_PLAN_ID,
                    prices: [
                        priceWith({
                            id: 'price_quarterly',
                            unitAmount: 300_000, // 100_000/month
                            billingInterval: 'month',
                            intervalCount: 3
                        })
                    ]
                },
                targetPlan: {
                    id: TARGET_PLAN_ID,
                    prices: [
                        priceWith({
                            id: TARGET_PRICE_ID,
                            unitAmount: 120_000, // 120_000/month — higher
                            billingInterval: 'month',
                            intervalCount: 1
                        })
                    ]
                }
            });

            const sub3Month = {
                ...makeSub({ planId: CURRENT_PLAN_ID }),
                interval: 'month' as const,
                intervalCount: 3
            };
            billing.subscriptions.get.mockResolvedValue(sub3Month);

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
    });
});

// ---------------------------------------------------------------------------
// normalizedUnitAmount helper (_internals)
// ---------------------------------------------------------------------------

describe('_internals.normalizedUnitAmount', () => {
    it('returns unitAmount unchanged when intervalCount is 1', () => {
        expect(
            _internals.normalizedUnitAmount({
                id: 'p',
                billingInterval: 'month',
                intervalCount: 1,
                unitAmount: 120_000,
                active: true
            })
        ).toBe(120_000);
    });

    it('divides by intervalCount for multi-period prices', () => {
        expect(
            _internals.normalizedUnitAmount({
                id: 'p',
                billingInterval: 'month',
                intervalCount: 3,
                unitAmount: 360_000,
                active: true
            })
        ).toBe(120_000);
    });

    it('treats null/undefined intervalCount as 1', () => {
        expect(
            _internals.normalizedUnitAmount({
                id: 'p',
                billingInterval: 'month',
                intervalCount: null as unknown as number,
                unitAmount: 100_000,
                active: true
            })
        ).toBe(100_000);
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

// ---------------------------------------------------------------------------
// keepSelections persistence — scheduleSubscriptionDowngrade (SPEC-167 T-015)
// ---------------------------------------------------------------------------

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';
const VALID_URL_1 = 'https://cdn.example.com/img1.jpg';
const VALID_URL_2 = 'https://cdn.example.com/img2.jpg';

describe('scheduleSubscriptionDowngrade — keepSelections persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('persists keepSelections as a JSON string in metadata when provided', async () => {
        const billing = createBillingMock();

        await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY,
            keepSelections: {
                accommodationIds: [VALID_UUID_1],
                promotionIds: [VALID_UUID_2],
                photoKeepMap: { [VALID_UUID_1]: [VALID_URL_1] }
            }
        });

        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        const scheduled = updateInput.scheduledPlanChange as Record<string, unknown>;
        const meta = scheduled.metadata as Record<string, unknown>;

        // keepSelections is stored as a JSON string (QZPayMetadata constraint)
        expect(typeof meta.keepSelections).toBe('string');
        const decoded = JSON.parse(meta.keepSelections as string);
        expect(decoded).toMatchObject({
            accommodationIds: [VALID_UUID_1],
            promotionIds: [VALID_UUID_2],
            photoKeepMap: { [VALID_UUID_1]: [VALID_URL_1] }
        });
    });

    it('omits keepSelections from metadata when not provided', async () => {
        const billing = createBillingMock();

        await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY
            // no keepSelections
        });

        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        const scheduled = updateInput.scheduledPlanChange as Record<string, unknown>;
        const meta = scheduled.metadata as Record<string, unknown>;
        expect(meta.keepSelections).toBeUndefined();
    });

    it('keeps other metadata fields (source, previousPlanId) alongside keepSelections', async () => {
        const billing = createBillingMock();

        await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY,
            keepSelections: { accommodationIds: [VALID_UUID_1] }
        });

        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        const scheduled = updateInput.scheduledPlanChange as Record<string, unknown>;
        const meta = scheduled.metadata as Record<string, unknown>;

        expect(meta.source).toBe('plan-change-downgrade');
        expect(meta.previousPlanId).toBe(CURRENT_PLAN_ID);
        expect(meta.keepSelections).toBeDefined();
    });

    it('replaces old keepSelections on replacedPriorSchedule (new selections win)', async () => {
        // Subscription already has a pending schedule (would be overwritten)
        const billing = createBillingMock({
            sub: makeSub({
                scheduledPlanChange: { status: 'pending', newPlanId: 'plan_some_other' }
            })
        });

        const newSelections = { accommodationIds: [VALID_UUID_2] };

        const result = await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY,
            keepSelections: newSelections
        });

        expect(result.replacedPriorSchedule).toBe(true);

        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        const scheduled = updateInput.scheduledPlanChange as Record<string, unknown>;
        const meta = scheduled.metadata as Record<string, unknown>;
        const decoded = JSON.parse(meta.keepSelections as string);
        // The new selection (UUID_2) wins — no trace of the old schedule's UUIDs
        expect(decoded.accommodationIds).toEqual([VALID_UUID_2]);
    });

    it('stores only partial selections when only some fields are provided', async () => {
        const billing = createBillingMock();

        await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY,
            keepSelections: { promotionIds: [VALID_UUID_1] }
        });

        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        const meta = (updateInput.scheduledPlanChange as Record<string, unknown>)
            .metadata as Record<string, unknown>;
        const decoded = JSON.parse(meta.keepSelections as string);
        expect(decoded.promotionIds).toEqual([VALID_UUID_1]);
        expect(decoded.accommodationIds).toBeUndefined();
        expect(decoded.photoKeepMap).toBeUndefined();
    });

    it('degrades gracefully when keepSelections fails validation (proceeds without it)', async () => {
        const billing = createBillingMock();

        // Pass an invalid shape — service should still schedule, just without keepSelections
        await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY,
            keepSelections: { accommodationIds: ['not-a-uuid'] } as unknown as {
                accommodationIds: string[];
            }
        });

        // Still called update (schedule was written)
        expect(billing.subscriptions.update).toHaveBeenCalledOnce();
        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        const meta = (updateInput.scheduledPlanChange as Record<string, unknown>)
            .metadata as Record<string, unknown>;
        // keepSelections silently omitted — validation failure degrades to absent
        expect(meta.keepSelections).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// getKeepSelectionsForChange — read-back helper (SPEC-167 T-015)
// ---------------------------------------------------------------------------

describe('getKeepSelectionsForChange', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test helper — QZPayMetadata is opaque, cast for structural tests
    function makeChange(metaOverride?: Record<string, unknown>): { metadata: any } {
        return {
            metadata: metaOverride ?? {}
        };
    }

    it('returns parsed KeepSelections when stored as a valid JSON string', () => {
        const stored = {
            accommodationIds: [VALID_UUID_1],
            promotionIds: [VALID_UUID_2],
            photoKeepMap: { [VALID_UUID_1]: [VALID_URL_1, VALID_URL_2] }
        };
        const change = makeChange({ keepSelections: JSON.stringify(stored) });
        const result = getKeepSelectionsForChange(change);
        expect(result).toMatchObject(stored);
    });

    it('returns undefined when metadata has no keepSelections key', () => {
        const change = makeChange({ source: 'plan-change-downgrade' });
        expect(getKeepSelectionsForChange(change)).toBeUndefined();
    });

    it('returns undefined when metadata is null', () => {
        // Direct object with null metadata — cast through any to satisfy QZPayMetadata constraint
        // biome-ignore lint/suspicious/noExplicitAny: testing null metadata runtime path
        expect(getKeepSelectionsForChange({ metadata: null } as any)).toBeUndefined();
    });

    it('returns undefined when metadata is undefined', () => {
        // biome-ignore lint/suspicious/noExplicitAny: testing undefined metadata runtime path
        expect(getKeepSelectionsForChange({ metadata: undefined } as any)).toBeUndefined();
    });

    it('returns undefined when keepSelections is not valid JSON', () => {
        const change = makeChange({ keepSelections: 'not-json{{{' });
        expect(getKeepSelectionsForChange(change)).toBeUndefined();
    });

    it('returns undefined when keepSelections JSON parses but fails schema validation', () => {
        // Valid JSON but wrong shape (non-UUID in accommodationIds)
        const invalid = JSON.stringify({ accommodationIds: ['not-a-uuid'] });
        const change = makeChange({ keepSelections: invalid });
        expect(getKeepSelectionsForChange(change)).toBeUndefined();
    });

    it('returns parsed selections with only accommodationIds', () => {
        const stored = { accommodationIds: [VALID_UUID_1] };
        const change = makeChange({ keepSelections: JSON.stringify(stored) });
        const result = getKeepSelectionsForChange(change);
        expect(result?.accommodationIds).toEqual([VALID_UUID_1]);
        expect(result?.promotionIds).toBeUndefined();
    });

    it('returns parsed selections with only photoKeepMap', () => {
        const stored = { photoKeepMap: { [VALID_UUID_1]: [VALID_URL_1] } };
        const change = makeChange({ keepSelections: JSON.stringify(stored) });
        const result = getKeepSelectionsForChange(change);
        expect(result?.photoKeepMap?.[VALID_UUID_1]).toEqual([VALID_URL_1]);
    });

    it('returns parsed selections with an empty object (all fields optional)', () => {
        const stored = {};
        const change = makeChange({ keepSelections: JSON.stringify(stored) });
        const result = getKeepSelectionsForChange(change);
        expect(result).toEqual({});
    });

    it('returns undefined when keepSelections is null in metadata', () => {
        const change = makeChange({ keepSelections: null as unknown as string });
        expect(getKeepSelectionsForChange(change)).toBeUndefined();
    });

    it('round-trip: stored via scheduleSubscriptionDowngrade, read back correctly', async () => {
        const billing = createBillingMock();
        const selections = {
            accommodationIds: [VALID_UUID_1],
            promotionIds: [VALID_UUID_2],
            photoKeepMap: { [VALID_UUID_1]: [VALID_URL_1, VALID_URL_2] }
        };

        await scheduleSubscriptionDowngrade({
            currentSubscriptionId: SUB_ID,
            newPlanId: TARGET_PLAN_ID,
            billingInterval: 'month',
            intervalCount: 1,
            // biome-ignore lint/suspicious/noExplicitAny: structural mock
            billing: billing as any,
            now: HALFWAY,
            keepSelections: selections
        });

        // Extract the stored scheduledPlanChange from the update call
        const [, updateInput] = billing.subscriptions.update.mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        const storedChange = updateInput.scheduledPlanChange as Record<string, unknown>;

        // Use the read-back helper (cast to satisfy QZPayMetadata opaque type)
        // biome-ignore lint/suspicious/noExplicitAny: QZPayMetadata is opaque; structural cast for test
        const readBack = getKeepSelectionsForChange(storedChange as any);

        expect(readBack).toMatchObject(selections);
    });
});

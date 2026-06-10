/**
 * Gate tests: plan-change rejected when the TARGET plan is inactive (SPEC-148 T-006).
 *
 * A user must not be able to change to a disabled (retired) plan. When
 * `billing.plans.get(newPlanId)` returns a plan with `active === false`,
 * the handler must throw ServiceError(PLAN_DISABLED, …) (HTTP 410) before
 * any upgrade/downgrade branch logic runs.
 *
 * Also verifies:
 * - An active target plan passes through the guard unaffected.
 * - The ServiceError is re-thrown before isBillingProviderError (SPEC-149
 *   regression).
 *
 * @module test/routes/billing/plan-change-plan-disabled
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared BEFORE imports of the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/sentry')>();
    return { ...actual, captureBillingError: vi.fn() };
});

vi.mock('../../../src/lib/billing-provider-error', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/billing-provider-error')>();
    return { ...actual };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, initiatePaidPlanUpgrade: vi.fn() };
});

vi.mock('../../../src/services/subscription-downgrade.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, scheduleSubscriptionDowngrade: vi.fn() };
});

vi.mock('../../../src/services/subscription-downgrade-excess.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, computeDowngradeExcess: vi.fn() };
});

vi.mock('../../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { captureBillingError } from '../../../src/lib/sentry';
import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_plan_disabled_change_test';
const ACTOR_ID = '00000000-0000-4000-8000-000000000077';
const CURRENT_PLAN_ID = 'plan_basic';
const TARGET_PLAN_ID_DISABLED = 'plan_legacy';
const TARGET_PLAN_ID_ACTIVE = 'plan_pro';

function makeContext(body: unknown) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID],
        ['actor', { id: ACTOR_ID, role: 'USER', permissions: [] }]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        req: { json: vi.fn().mockResolvedValue(body) }
    };
}

/**
 * Build a billing mock. The active sub has no cancelAtPeriodEnd (so the
 * SPEC-147 cancel guard passes). `targetPlanActive` controls the `active`
 * field on the target plan returned by `plans.get`.
 *
 * Prices: current=200k, target=300k (upgrade path so we reach the guard
 * before branch-specific logic) when targetPlanActive = false.
 */
function makeBillingMock(opts: { targetPlanActive: boolean; targetPlanId: string }) {
    const activeSub = {
        id: 'sub_plan_change_disabled_001',
        planId: CURRENT_PLAN_ID,
        status: 'active',
        interval: 'month',
        intervalCount: 1,
        cancelAtPeriodEnd: false
    };

    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([activeSub]),
            changePlan: vi.fn()
        },
        plans: {
            get: vi.fn().mockImplementation((id: string) => {
                if (id === CURRENT_PLAN_ID) {
                    return Promise.resolve({
                        id: CURRENT_PLAN_ID,
                        name: 'plan-basic',
                        active: true,
                        prices: [
                            {
                                id: 'price_basic',
                                billingInterval: 'month',
                                unitAmount: 200_000,
                                intervalCount: 1
                            }
                        ]
                    });
                }
                // Target plan — may be inactive
                return Promise.resolve({
                    id: opts.targetPlanId,
                    name: opts.targetPlanId,
                    active: opts.targetPlanActive,
                    prices: [
                        {
                            id: `price_${opts.targetPlanId}`,
                            billingInterval: 'month',
                            unitAmount: 300_000,
                            intervalCount: 1
                        }
                    ]
                });
            })
        }
    };
}

function mockBillingWith(billing: ReturnType<typeof makeBillingMock>) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange — plan-disabled guard (SPEC-148 T-006)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(captureBillingError).mockReturnValue('sentinel-event-id');
    });

    describe('change to a disabled target plan', () => {
        it('throws ServiceError(PLAN_DISABLED) when target plan is inactive', async () => {
            mockBillingWith(
                makeBillingMock({
                    targetPlanActive: false,
                    targetPlanId: TARGET_PLAN_ID_DISABLED
                })
            );

            const ctx = makeContext({
                newPlanId: TARGET_PLAN_ID_DISABLED,
                billingInterval: 'monthly'
            });
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PLAN_DISABLED
            );
        });

        it('reason field is PLAN_DISABLED', async () => {
            mockBillingWith(
                makeBillingMock({
                    targetPlanActive: false,
                    targetPlanId: TARGET_PLAN_ID_DISABLED
                })
            );

            const ctx = makeContext({
                newPlanId: TARGET_PLAN_ID_DISABLED,
                billingInterval: 'monthly'
            });
            const err = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).reason).toBe('PLAN_DISABLED');
        });

        it('guard fires before any upgrade/downgrade provider call', async () => {
            const billing = makeBillingMock({
                targetPlanActive: false,
                targetPlanId: TARGET_PLAN_ID_DISABLED
            });
            mockBillingWith(billing);

            const ctx = makeContext({
                newPlanId: TARGET_PLAN_ID_DISABLED,
                billingInterval: 'monthly'
            });
            await handlePlanChange(ctx as never).catch(() => undefined);

            // plans.get for target plan IS called (to discover it's inactive),
            // but changePlan must NOT be called.
            expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
        });

        it('error message mentions plan no longer available', async () => {
            mockBillingWith(
                makeBillingMock({
                    targetPlanActive: false,
                    targetPlanId: TARGET_PLAN_ID_DISABLED
                })
            );

            const ctx = makeContext({
                newPlanId: TARGET_PLAN_ID_DISABLED,
                billingInterval: 'monthly'
            });
            const err = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).message.toLowerCase()).toMatch(/no longer available/);
        });

        it('captureBillingError NOT called for plan-disabled error', async () => {
            mockBillingWith(
                makeBillingMock({
                    targetPlanActive: false,
                    targetPlanId: TARGET_PLAN_ID_DISABLED
                })
            );

            const ctx = makeContext({
                newPlanId: TARGET_PLAN_ID_DISABLED,
                billingInterval: 'monthly'
            });
            await handlePlanChange(ctx as never).catch(() => undefined);

            expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
        });
    });

    describe('change to an active target plan passes through guard', () => {
        it('does NOT throw PLAN_DISABLED when target plan is active', async () => {
            mockBillingWith(
                makeBillingMock({ targetPlanActive: true, targetPlanId: TARGET_PLAN_ID_ACTIVE })
            );

            const ctx = makeContext({
                newPlanId: TARGET_PLAN_ID_ACTIVE,
                billingInterval: 'monthly'
            });
            const err = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(err).not.toSatisfy(
                (e: unknown) =>
                    e instanceof ServiceError && e.code === ServiceErrorCode.PLAN_DISABLED
            );
        });
    });

    describe('SPEC-149 regression: PLAN_DISABLED ServiceError re-thrown before isBillingProviderError', () => {
        it('thrown error is ServiceError, not wrapped as HTTPException 500', async () => {
            mockBillingWith(
                makeBillingMock({
                    targetPlanActive: false,
                    targetPlanId: TARGET_PLAN_ID_DISABLED
                })
            );

            const ctx = makeContext({
                newPlanId: TARGET_PLAN_ID_DISABLED,
                billingInterval: 'monthly'
            });
            const err = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect(err).not.toMatchObject({ status: 500 });
        });
    });
});

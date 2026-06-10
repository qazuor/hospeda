/**
 * Gate tests: plan-change blocked when cancelAtPeriodEnd=true (SPEC-147 T-008 / Q7).
 *
 * Q7 resolution (owner): The cancel wins. When a subscription has
 * `cancelAtPeriodEnd=true`, the user MUST NOT be able to change plan.
 * The endpoint must reject with a ServiceError(ALREADY_EXISTS, …, 'SUBSCRIPTION_CANCEL_PENDING')
 * (HTTP 409) before any provider work is done.
 *
 * Also verifies:
 * - A normal active sub without the flag is unaffected (existing behavior).
 * - The provider-error 29-test regression suite is not disturbed (separate file).
 *
 * @module test/routes/billing/plan-change-cancel-pending
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

import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_cancel_pending_test';
const ACTOR_ID = '00000000-0000-4000-8000-000000000088';
const CURRENT_PLAN_ID = 'plan_basic';
const TARGET_PLAN_ID = 'plan_pro';

/**
 * Build a Hono-like context with optional body.
 */
function makeContext(body: unknown = { newPlanId: TARGET_PLAN_ID, billingInterval: 'monthly' }) {
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
 * Build a billing mock whose getByCustomerId returns a subscription with
 * the given cancelAtPeriodEnd flag.
 * Price: current=200k, target=300k (upgrade path) — ensures we hit Q7 before
 * any branch-specific logic.
 */
function makeBillingMock(opts: { cancelAtPeriodEnd: boolean }) {
    const activeSub = {
        id: 'sub_cancel_pending_001',
        planId: CURRENT_PLAN_ID,
        status: 'active',
        interval: 'month',
        intervalCount: 1,
        cancelAtPeriodEnd: opts.cancelAtPeriodEnd
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
                        prices: [
                            {
                                id: 'price_current',
                                billingInterval: 'month',
                                unitAmount: 200_000,
                                intervalCount: 1
                            }
                        ]
                    });
                }
                return Promise.resolve({
                    id: TARGET_PLAN_ID,
                    name: 'plan-pro',
                    prices: [
                        {
                            id: 'price_target',
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

describe('handlePlanChange — cancel-pending gate (SPEC-147 T-008 / Q7)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('blocked when cancelAtPeriodEnd=true', () => {
        it('rejects with ServiceError(ALREADY_EXISTS) when sub has cancelAtPeriodEnd=true', async () => {
            mockBillingWith(makeBillingMock({ cancelAtPeriodEnd: true }));

            const ctx = makeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.ALREADY_EXISTS
            );
        });

        it('rejects with reason=SUBSCRIPTION_CANCEL_PENDING when cancelAtPeriodEnd=true', async () => {
            mockBillingWith(makeBillingMock({ cancelAtPeriodEnd: true }));

            const ctx = makeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.reason === 'SUBSCRIPTION_CANCEL_PENDING'
            );
        });

        it('rejects before any provider call (getByCustomerId not called again, plans.get not called)', async () => {
            const billing = makeBillingMock({ cancelAtPeriodEnd: true });
            mockBillingWith(billing);

            const ctx = makeContext();
            await handlePlanChange(ctx as never).catch(() => undefined);

            // getByCustomerId is called once to fetch the subscription, then the guard fires.
            // plans.get must NOT be called — the guard is pre-plan-lookup.
            expect(billing.subscriptions.getByCustomerId).toHaveBeenCalledTimes(1);
            expect(billing.plans.get).not.toHaveBeenCalled();
        });

        it('error message mentions scheduling or cancel-pending context', async () => {
            mockBillingWith(makeBillingMock({ cancelAtPeriodEnd: true }));

            const ctx = makeContext();
            const err = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).message.toLowerCase()).toMatch(/cancel/i);
        });
    });

    describe('not blocked when cancelAtPeriodEnd=false (normal active sub)', () => {
        it('does NOT throw ALREADY_EXISTS for a normal active subscription', async () => {
            const billing = makeBillingMock({ cancelAtPeriodEnd: false });
            mockBillingWith(billing);

            // plans.get will be called (normal flow); let getByCustomerId return fine.
            // The handler will eventually call plans.get for target plan resolution.
            // For this test we just need it to pass the Q7 guard and proceed normally.
            // It may still throw (upgrade flow needs initiatePaidPlanUpgrade mock) but
            // it must NOT throw ALREADY_EXISTS.
            const ctx = makeContext();
            const err = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(err).not.toSatisfy(
                (e: unknown) =>
                    e instanceof ServiceError &&
                    e.code === ServiceErrorCode.ALREADY_EXISTS &&
                    e.reason === 'SUBSCRIPTION_CANCEL_PENDING'
            );
        });
    });

    describe('also blocked when trialing subscription has cancelAtPeriodEnd=true', () => {
        it('trialing + cancelAtPeriodEnd=true → rejected with ALREADY_EXISTS / SUBSCRIPTION_CANCEL_PENDING', async () => {
            const billing = {
                subscriptions: {
                    getByCustomerId: vi.fn().mockResolvedValue([
                        {
                            id: 'sub_trialing_cancel',
                            planId: CURRENT_PLAN_ID,
                            status: 'trialing',
                            interval: 'month',
                            intervalCount: 1,
                            cancelAtPeriodEnd: true
                        }
                    ]),
                    changePlan: vi.fn()
                },
                plans: { get: vi.fn() }
            };
            vi.mocked(getQZPayBilling).mockReturnValue(
                billing as unknown as ReturnType<typeof getQZPayBilling>
            );

            const ctx = makeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError &&
                    err.code === ServiceErrorCode.ALREADY_EXISTS &&
                    err.reason === 'SUBSCRIPTION_CANCEL_PENDING'
            );
        });
    });
});

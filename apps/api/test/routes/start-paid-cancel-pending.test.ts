/**
 * Gate tests: start-paid blocked when user has a soft-cancelled subscription
 * (cancelAtPeriodEnd=true) (SPEC-147 T-008 / Q7).
 *
 * Q7 resolution (owner): The cancel wins. If the user already has a
 * subscription with `cancelAtPeriodEnd=true`, re-subscribing (start-paid)
 * must be blocked with a ServiceError(ALREADY_EXISTS, …, 'SUBSCRIPTION_CANCEL_PENDING')
 * (HTTP 409) before any provider work is done.
 *
 * This guard closes the race condition where a user cancels and immediately
 * re-subscribes, causing two overlapping active subscriptions.
 *
 * Also verifies a user with NO existing subscription (normal new checkout)
 * is unaffected.
 *
 * @module test/routes/start-paid-cancel-pending
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared BEFORE imports of the route file).
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/lib/sentry')>();
    return { ...actual, captureBillingError: vi.fn() };
});

vi.mock('../../src/lib/billing-provider-error', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/lib/billing-provider-error')>();
    return { ...actual };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('@repo/db', () => {
    const insertChain = {
        values: vi.fn().mockResolvedValue(undefined)
    };
    return {
        getDb: vi.fn(() => ({
            insert: vi.fn(() => insertChain)
        })),
        billingSubscriptions: { __table: 'billing_subscriptions' }
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../src/middlewares/billing';
import { handleStartPaidSubscription } from '../../src/routes/billing/start-paid';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_start_paid_cancel_test';
const PLAN_SLUG = 'owner-basico';
const PLAN_ID = 'plan_basico_id';
const PRICE_ID = 'price_monthly_basico';

function makeContext(opts: { billingCustomerId?: string | null } = {}) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', opts.billingCustomerId ?? CUSTOMER_ID],
        ['user', null]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k))
    };
}

/**
 * Build a billing mock that:
 *  - `getByCustomerId` returns the given subscriptions list.
 *  - `plans.list` returns a plan with a monthly price.
 *  - `subscriptions.create` resolves with a fake subscription (never called when guard fires).
 */
function makeBillingMock(opts: {
    existingSubscriptions?: Array<{ id: string; status: string; cancelAtPeriodEnd: boolean }>;
}) {
    const existingSubs = opts.existingSubscriptions ?? [];

    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(existingSubs),
            create: vi.fn().mockResolvedValue({
                id: 'sub_new_123',
                providerInitPoint: 'https://mp.test/checkout/new',
                providerSandboxInitPoint: null
            })
        },
        plans: {
            list: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: PLAN_ID,
                        name: PLAN_SLUG,
                        prices: [
                            {
                                id: PRICE_ID,
                                billingInterval: 'month',
                                intervalCount: 1,
                                active: true
                            }
                        ]
                    }
                ]
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

describe('handleStartPaidSubscription — cancel-pending gate (SPEC-147 T-008 / Q7)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('blocked when existing subscription has cancelAtPeriodEnd=true', () => {
        it('rejects with ServiceError(ALREADY_EXISTS) when a soft-cancelled sub exists', async () => {
            mockBillingWith(
                makeBillingMock({
                    existingSubscriptions: [
                        { id: 'sub_soft_cancel', status: 'active', cancelAtPeriodEnd: true }
                    ]
                })
            );

            const ctx = makeContext();
            await expect(
                handleStartPaidSubscription(ctx as never, {
                    planSlug: PLAN_SLUG,
                    billingInterval: 'monthly'
                })
            ).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.ALREADY_EXISTS
            );
        });

        it('rejects with reason=SUBSCRIPTION_CANCEL_PENDING when a soft-cancelled sub exists', async () => {
            mockBillingWith(
                makeBillingMock({
                    existingSubscriptions: [
                        { id: 'sub_soft_cancel', status: 'active', cancelAtPeriodEnd: true }
                    ]
                })
            );

            const ctx = makeContext();
            await expect(
                handleStartPaidSubscription(ctx as never, {
                    planSlug: PLAN_SLUG,
                    billingInterval: 'monthly'
                })
            ).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.reason === 'SUBSCRIPTION_CANCEL_PENDING'
            );
        });

        it('subscriptions.create NOT called when soft-cancel guard fires', async () => {
            const billing = makeBillingMock({
                existingSubscriptions: [
                    { id: 'sub_soft_cancel', status: 'active', cancelAtPeriodEnd: true }
                ]
            });
            mockBillingWith(billing);

            const ctx = makeContext();
            await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG,
                billingInterval: 'monthly'
            }).catch(() => undefined);

            expect(billing.subscriptions.create).not.toHaveBeenCalled();
        });

        it('error message mentions cancel-pending context', async () => {
            mockBillingWith(
                makeBillingMock({
                    existingSubscriptions: [
                        { id: 'sub_soft_cancel', status: 'active', cancelAtPeriodEnd: true }
                    ]
                })
            );

            const ctx = makeContext();
            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).message.toLowerCase()).toMatch(/cancel/i);
        });

        it('also blocked for annual billing interval when soft-cancel pending', async () => {
            mockBillingWith(
                makeBillingMock({
                    existingSubscriptions: [
                        { id: 'sub_soft_cancel', status: 'active', cancelAtPeriodEnd: true }
                    ]
                })
            );

            const ctx = makeContext();
            await expect(
                handleStartPaidSubscription(ctx as never, {
                    planSlug: PLAN_SLUG,
                    billingInterval: 'annual'
                })
            ).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError &&
                    err.code === ServiceErrorCode.ALREADY_EXISTS &&
                    err.reason === 'SUBSCRIPTION_CANCEL_PENDING'
            );
        });
    });

    describe('not blocked when no existing soft-cancelled subscription', () => {
        it('does NOT throw cancel-pending error when no existing subscriptions', async () => {
            const billing = makeBillingMock({ existingSubscriptions: [] });
            mockBillingWith(billing);

            // No existing sub → guard passes; normal flow proceeds.
            // subscriptions.create may be called (monthly flow).
            const ctx = makeContext();
            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            expect(err).not.toSatisfy(
                (e: unknown) =>
                    e instanceof ServiceError &&
                    e.code === ServiceErrorCode.ALREADY_EXISTS &&
                    e.reason === 'SUBSCRIPTION_CANCEL_PENDING'
            );
        });

        it('does NOT throw cancel-pending error when existing sub has cancelAtPeriodEnd=false', async () => {
            const billing = makeBillingMock({
                existingSubscriptions: [
                    { id: 'sub_active_normal', status: 'active', cancelAtPeriodEnd: false }
                ]
            });
            mockBillingWith(billing);

            const ctx = makeContext();
            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            expect(err).not.toSatisfy(
                (e: unknown) =>
                    e instanceof ServiceError &&
                    e.code === ServiceErrorCode.ALREADY_EXISTS &&
                    e.reason === 'SUBSCRIPTION_CANCEL_PENDING'
            );
        });
    });
});

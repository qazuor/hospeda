/**
 * Gate tests: start-paid rejected when the target plan is inactive (SPEC-148 T-006).
 *
 * When a plan has `active === false` (disabled/retired), both the monthly and
 * annual checkout paths must immediately throw a
 * ServiceError(PLAN_DISABLED, …) (HTTP 410) without touching the payment
 * provider. The guard must fire BEFORE any provider call.
 *
 * Also verifies:
 * - An active plan passes through the guard unaffected.
 * - The ServiceError is NOT misidentified as a provider error (SPEC-149
 *   regression: the re-throw for ServiceError must come before
 *   isBillingProviderError in the outer catch).
 *
 * @module test/routes/billing/start-paid-plan-disabled
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared BEFORE imports of the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
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
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('@repo/db', () => {
    const insertChain = { values: vi.fn().mockResolvedValue(undefined) };
    return {
        getDb: vi.fn(() => ({ insert: vi.fn(() => insertChain) })),
        billingSubscriptions: { __table: 'billing_subscriptions' }
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { captureBillingError } from '../../../src/lib/sentry';
import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handleStartPaidSubscription } from '../../../src/routes/billing/start-paid';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_plan_disabled_test';
const PLAN_SLUG_DISABLED = 'owner-legacy';
const PLAN_SLUG_ACTIVE = 'owner-basico';

function makeContext(opts: { billingCustomerId?: string | null } = {}) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', opts.billingCustomerId ?? CUSTOMER_ID],
        ['user', null]
    ]);
    return { get: vi.fn((k: string) => store.get(k)) };
}

/**
 * Build a billing mock. `planActive` controls the `active` field on the plan
 * returned by `plans.list`. No existing subscriptions — the soft-cancel guard
 * (SPEC-147) must pass so we reach the plan-disabled guard.
 */
function makeBillingMock(opts: { planActive: boolean; planSlug: string }) {
    const plan = {
        id: `plan_${opts.planSlug}`,
        name: opts.planSlug,
        active: opts.planActive,
        prices: [
            {
                id: `price_${opts.planSlug}_monthly`,
                billingInterval: 'month',
                intervalCount: 1,
                active: true
            },
            {
                id: `price_${opts.planSlug}_annual`,
                billingInterval: 'year',
                intervalCount: 1,
                active: true
            }
        ],
        metadata: {}
    };

    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({
                id: 'sub_new_test',
                providerInitPoint: 'https://mp.test/checkout',
                providerSandboxInitPoint: null
            })
        },
        plans: {
            list: vi.fn().mockResolvedValue({ data: [plan] })
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

describe('handleStartPaidSubscription — plan-disabled guard (SPEC-148 T-006)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(captureBillingError).mockReturnValue('sentinel-event-id');
    });

    describe('monthly checkout on a disabled plan', () => {
        it('throws ServiceError(PLAN_DISABLED) when monthly plan is inactive', async () => {
            mockBillingWith(makeBillingMock({ planActive: false, planSlug: PLAN_SLUG_DISABLED }));

            const ctx = makeContext();
            await expect(
                handleStartPaidSubscription(ctx as never, {
                    planSlug: PLAN_SLUG_DISABLED,
                    billingInterval: 'monthly'
                })
            ).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PLAN_DISABLED
            );
        });

        it('reason field is PLAN_DISABLED for monthly', async () => {
            mockBillingWith(makeBillingMock({ planActive: false, planSlug: PLAN_SLUG_DISABLED }));

            const ctx = makeContext();
            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG_DISABLED,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).reason).toBe('PLAN_DISABLED');
        });

        it('subscriptions.create NOT called when plan-disabled guard fires (monthly)', async () => {
            const billing = makeBillingMock({
                planActive: false,
                planSlug: PLAN_SLUG_DISABLED
            });
            mockBillingWith(billing);

            const ctx = makeContext();
            await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG_DISABLED,
                billingInterval: 'monthly'
            }).catch(() => undefined);

            expect(billing.subscriptions.create).not.toHaveBeenCalled();
        });

        it('error message mentions plan no longer available', async () => {
            mockBillingWith(makeBillingMock({ planActive: false, planSlug: PLAN_SLUG_DISABLED }));

            const ctx = makeContext();
            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG_DISABLED,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).message.toLowerCase()).toMatch(/no longer available/);
        });

        it('captureBillingError NOT called for plan-disabled error (not a provider error)', async () => {
            mockBillingWith(makeBillingMock({ planActive: false, planSlug: PLAN_SLUG_DISABLED }));

            const ctx = makeContext();
            await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG_DISABLED,
                billingInterval: 'monthly'
            }).catch(() => undefined);

            expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
        });
    });

    describe('annual checkout on a disabled plan', () => {
        it('throws ServiceError(PLAN_DISABLED) when annual plan is inactive', async () => {
            mockBillingWith(makeBillingMock({ planActive: false, planSlug: PLAN_SLUG_DISABLED }));

            const ctx = makeContext();
            await expect(
                handleStartPaidSubscription(ctx as never, {
                    planSlug: PLAN_SLUG_DISABLED,
                    billingInterval: 'annual'
                })
            ).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PLAN_DISABLED
            );
        });

        it('subscriptions.create NOT called when plan-disabled guard fires (annual)', async () => {
            const billing = makeBillingMock({ planActive: false, planSlug: PLAN_SLUG_DISABLED });
            mockBillingWith(billing);

            const ctx = makeContext();
            await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG_DISABLED,
                billingInterval: 'annual'
            }).catch(() => undefined);

            expect(billing.subscriptions.create).not.toHaveBeenCalled();
        });
    });

    describe('active plan passes through guard unaffected', () => {
        it('does NOT throw PLAN_DISABLED for an active plan (monthly)', async () => {
            mockBillingWith(makeBillingMock({ planActive: true, planSlug: PLAN_SLUG_ACTIVE }));

            const ctx = makeContext();
            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG_ACTIVE,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            expect(err).not.toSatisfy(
                (e: unknown) =>
                    e instanceof ServiceError && e.code === ServiceErrorCode.PLAN_DISABLED
            );
        });

        it('does NOT throw PLAN_DISABLED for an active plan (annual)', async () => {
            mockBillingWith(makeBillingMock({ planActive: true, planSlug: PLAN_SLUG_ACTIVE }));

            const ctx = makeContext();
            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG_ACTIVE,
                billingInterval: 'annual'
            }).catch((e: unknown) => e);

            expect(err).not.toSatisfy(
                (e: unknown) =>
                    e instanceof ServiceError && e.code === ServiceErrorCode.PLAN_DISABLED
            );
        });
    });

    describe('SPEC-149 regression: PLAN_DISABLED ServiceError is re-thrown before isBillingProviderError', () => {
        it('thrown error is ServiceError (not misidentified as provider error)', async () => {
            mockBillingWith(makeBillingMock({ planActive: false, planSlug: PLAN_SLUG_DISABLED }));

            const ctx = makeContext();
            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG_DISABLED,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            // Must be ServiceError, not wrapped in HTTPException
            expect(err).toBeInstanceOf(ServiceError);
            expect(err).not.toMatchObject({ status: 500 });
        });
    });
});

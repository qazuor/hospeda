/**
 * Unit tests for the start-paid subscription route (SPEC-126 D1 monthly).
 *
 * Covers:
 * - Happy path for monthly: plan resolution, price selection, qzpay
 *   create invocation with `mode: 'paid'`, response shape.
 * - Annual branch rejection (501, follow-up commit).
 * - Promo code FREEMONTH success (D9 — forwarded to service).
 * - Unknown promo code rejection (422, surfaced from service).
 * - 404 for unknown plan slug.
 * - 404 for plan without monthly price.
 * - 400/503 short-circuits.
 * - 500 when provider returns no init point.
 * - Fallback from sandbox init point when provider init point absent.
 * - expiresAt is roughly 30 minutes from now.
 *
 * @module test/routes/start-paid
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared BEFORE imports of the route file).
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

// Mock the actor middleware so the handler resolves a fake actor (the real one
// instantiates RRolePermissionModel at load — staging fix 05bc14a9e) without
// requiring an actor in the test context. These tests do not assert on actor
// identity, so a fixed actor is sufficient.
vi.mock('../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'user-1', email: 'test@test.com', roles: [] }))
}));

vi.mock('../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/lib/sentry')>();
    return {
        ...actual,
        captureBillingError: vi.fn()
    };
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

// PostHog capture spy — hoisted so it is available inside the vi.mock factory.
// Individual tests assert on `mockPostHogCapture` for the checkout_started event.
const { mockPostHogCapture, mockGetPostHogClient } = vi.hoisted(() => {
    const capture = vi.fn();
    return {
        mockPostHogCapture: capture,
        mockGetPostHogClient: vi.fn(() => ({ capture }))
    };
});
vi.mock('../../src/lib/posthog', () => ({
    getPostHogClient: mockGetPostHogClient
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

// Mock the checkout promo resolver so the happy-path FREEMONTH test (D9)
// does not require a live DB. The resolver crosses a module boundary
// (subscription-checkout.service.ts imports it via
// './subscription-checkout-promo.service.js'), so this vi.mock intercepts
// correctly. Convention matches subscription-checkout-promo-branches.test.ts.
//
// Behaviour:
//  - undefined / empty promoCode → { kind: 'none' } (mirrors the real early-exit).
//  - 'FREEMONTH' → { kind: 'trial', freeTrialDays: 30 } (SPEC-126 D9 trial extension).
//  - any other non-empty code → { kind: 'invalid', message: '...' } so that the
//    existing 422 rejection tests (NOT_A_REAL_CODE) continue to pass.
// The discount seam mutates the live MercadoPago preapproval amount and redeems the
// code, fail-closed. These are ROUTE tests — the seam has its own suite — so stub it
// to "MP accepted the lowered amount". Needed since HOS-171: a discount now coexists
// with a trial, so the trial-flavoured cases reach this call instead of returning
// early with the code discarded.
vi.mock('../../src/services/subscription-discount-signup.service', () => ({
    applySignupDiscountToMonthly: vi.fn(async () => ({
        success: true as const,
        data: { discountedAmountCentavos: 4_500_000, remainingCyclesSeed: null }
    }))
}));

vi.mock('../../src/services/subscription-checkout-promo.service', () => ({
    resolveCheckoutPromoPlan: vi.fn(
        async (input: {
            promoCode?: string;
        }): Promise<{
            kind: 'none' | 'trial' | 'invalid';
            freeTrialDays?: number;
            message?: string;
        }> => {
            if (!input.promoCode || input.promoCode.length === 0) {
                return { kind: 'none' };
            }
            if (input.promoCode.toUpperCase() === 'FREEMONTH') {
                return { kind: 'trial', freeTrialDays: 30 };
            }
            return {
                kind: 'invalid',
                message: `Promo code '${input.promoCode}' is not valid`
            };
        }
    )
}));

// HOS-122: `initiatePaidMonthlySubscription` / `initiatePaidAnnualSubscription`
// are wrapped in spies that call through to the REAL implementation by
// default, so every existing test in this file keeps driving through actual
// production branch logic unchanged. The new `checkout_completed` analytics
// tests override ONE call with `mockResolvedValueOnce` for the `comp` and
// signup-`discount` outcomes only: fully exercising those two branches would
// require mocking several extra `@repo/db` query shapes this file does not
// carry (`select().from(billingPlans)...`, `withTransaction`, a live MP
// preapproval mutation, `resolveFullPlanPriceCentavos`) that are already
// covered by dedicated service-level tests
// (`test/services/subscription-checkout-promo-branches.test.ts`). Since the
// route's `checkout_completed` capture only depends on the SHAPE of
// `result` (`appliedEffect` / `promoCodeIgnored` / `localSubscriptionId`),
// overriding the service call at this boundary is the minimal-risk way to
// unit test it without re-verifying the decision engine itself.
const { mockInitiatePaidAnnualSubscription, mockInitiatePaidMonthlySubscription } = vi.hoisted(
    () => ({
        mockInitiatePaidAnnualSubscription: vi.fn(),
        mockInitiatePaidMonthlySubscription: vi.fn()
    })
);
vi.mock('../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../src/services/subscription-checkout.service')>();
    mockInitiatePaidAnnualSubscription.mockImplementation(actual.initiatePaidAnnualSubscription);
    mockInitiatePaidMonthlySubscription.mockImplementation(actual.initiatePaidMonthlySubscription);
    return {
        ...actual,
        initiatePaidAnnualSubscription: mockInitiatePaidAnnualSubscription,
        initiatePaidMonthlySubscription: mockInitiatePaidMonthlySubscription
    };
});

// HOS-191: the real Initiate* flows now resolve/provision a MercadoPago
// preapproval_plan via `resolveCheckoutMpPlanId`, which reaches the payment
// adapter singleton + `billing_mp_plans`. Stub it at this one boundary so these
// route tests (which mock `@repo/db` and the billing middleware) exercise the
// checkout decision logic without a live adapter or DB. The provisioning service
// itself is unit-tested in `mp-plan-provisioning.test.ts`.
vi.mock('../../src/services/billing/mp-plan-provisioning.service', () => ({
    resolveCheckoutMpPlanId: vi.fn().mockResolvedValue('mp_plan_test'),
    resolveOrProvisionMpPlan: vi.fn()
}));

// `@repo/db` is mocked at module level so `initiatePaidAnnualSubscription`'s
// direct Drizzle insert into billing_subscriptions does not require a live
// Postgres. The default behaviour is a no-op insert; individual tests can
// inspect `getDb` calls if they need to assert the row shape.
vi.mock('@repo/db', () => {
    const insertChain = {
        values: vi.fn().mockResolvedValue(undefined)
    };
    return {
        getDb: vi.fn(() => ({
            insert: vi.fn(() => insertChain)
        })),
        billingSubscriptions: { __table: 'billing_subscriptions' },
        // Required by role-permissions-cache.ts (loaded via the actor middleware
        // at module load, staging fix 05bc14a9e). This test never resolves
        // permissions, so empty findAll stubs suffice.
        RRolePermissionModel: class MockRRolePermissionModel {
            async findAll(_filters: unknown, _opts?: unknown) {
                return { items: [], total: 0 };
            }
        },
        RUserPermissionModel: class MockRUserPermissionModel {
            async findAll(_filters: unknown, _opts?: unknown) {
                return { items: [], total: 0 };
            }
        }
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { QZPayProviderSyncError } from '@qazuor/qzpay-core';
import { PromoEffectKindEnum, ServiceErrorCode, ValueKindEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { captureBillingError } from '../../src/lib/sentry';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { _internals, handleStartPaidSubscription } from '../../src/routes/billing/start-paid';
// Mocked in the vi.mock block above -- imported here so HOS-122 tests can
// override its return value per-test with `vi.mocked(...).mockResolvedValueOnce(...)`.
import { resolveCheckoutPromoPlan } from '../../src/services/subscription-checkout-promo.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OWNER_CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const MONTHLY_PRICE_ID = 'price_monthly_1';
const ANNUAL_PRICE_ID = 'price_annual_1';

interface ContextOptions {
    billingEnabled?: boolean;
    billingCustomerId?: string | null;
    /** Optional user with settings for locale resolution (T-025). */
    user?: { settings?: Record<string, unknown> } | null;
}

function createMockContext(opts: ContextOptions = {}) {
    const { billingEnabled = true, billingCustomerId = OWNER_CUSTOMER_ID, user = null } = opts;

    const store = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId],
        ['user', user]
    ]);

    return {
        get: vi.fn((key: string) => store.get(key))
    };
}

interface PriceFixture {
    id: string;
    billingInterval: 'month' | 'year' | 'day' | 'week';
    intervalCount: number;
    active: boolean;
}

/** The trial length declared by the plan fixtures that have one. */
const PLAN_TRIAL_DAYS = 14;

/** Metadata for a plan that declares the standard owner trial. */
const TRIAL_METADATA = { hasTrial: true, trialDays: PLAN_TRIAL_DAYS };

/**
 * Builds a plan fixture. `metadata` drives the card-first trial resolution —
 * `resolvePlanTrialConfig` reads `hasTrial`/`trialDays` off it, and a plan without
 * metadata declares no trial at all.
 */
function createPlan(prices: PriceFixture[], metadata?: Record<string, unknown>) {
    return {
        id: PLAN_ID,
        name: 'owner-premium',
        prices,
        ...(metadata === undefined ? {} : { metadata })
    };
}

const MONTHLY_PRICE: PriceFixture = {
    id: MONTHLY_PRICE_ID,
    billingInterval: 'month',
    intervalCount: 1,
    active: true
};

const ANNUAL_PRICE: PriceFixture = {
    id: ANNUAL_PRICE_ID,
    billingInterval: 'year',
    intervalCount: 1,
    active: true
};

interface BillingMockOptions {
    plans?: ReturnType<typeof createPlan>[];
    subscription?: {
        id: string;
        providerInitPoint?: string;
        providerSandboxInitPoint?: string;
        providerSubscriptionIds?: { mercadopago?: string };
    } | null;
    createThrows?: Error;
}

function createBillingMock(opts: BillingMockOptions = {}) {
    const plans = opts.plans ?? [createPlan([MONTHLY_PRICE, ANNUAL_PRICE])];
    const subscription =
        opts.subscription === undefined
            ? {
                  id: LOCAL_SUB_ID,
                  providerInitPoint: 'https://mp.test/checkout/abc',
                  providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/abc',
                  // HOS-151 Bug C: a real paid preapproval always carries a
                  // provider subscription id; createPaidSubscription now rejects
                  // a response without one.
                  providerSubscriptionIds: { mercadopago: 'mp_preapproval_abc' }
              }
            : opts.subscription;

    const create = opts.createThrows
        ? vi.fn().mockRejectedValue(opts.createThrows)
        : vi.fn().mockResolvedValue(subscription);

    return {
        plans: {
            list: vi.fn().mockResolvedValue({ data: plans })
        },
        subscriptions: {
            // SPEC-147 T-008: getByCustomerId is now called by the cancel-pending
            // guard before any subscription creation. Default: no existing subs
            // (guard passes through). Tests that need soft-cancel behaviour use
            // the dedicated plan-change-cancel-pending / start-paid-cancel-pending
            // test files.
            getByCustomerId: vi.fn().mockResolvedValue([]),
            create
        }
    };
}

function mockBilling(billing: ReturnType<typeof createBillingMock> | null) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription (monthly)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a paid subscription and returns the checkout URL', async () => {
        const billing = createBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        const before = Date.now();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });
        const after = Date.now();

        expect(result.checkoutUrl).toBe('https://mp.test/checkout/abc');
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);

        // expiresAt should be roughly 30 minutes from now (allow 2s slack).
        const expiresAtMs = new Date(result.expiresAt).getTime();
        const thirtyMin = 30 * 60 * 1000;
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + thirtyMin - 2000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + thirtyMin + 2000);
    });

    it('invokes billing.subscriptions.create with the right arguments', async () => {
        const billing = createBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        const callArg = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg).toMatchObject({
            customerId: OWNER_CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: MONTHLY_PRICE_ID,
            mode: 'paid',
            billingInterval: 'monthly',
            notificationUrl:
                'https://api.hospeda.test/api/v1/webhooks/mercadopago?source_news=webhooks'
        });
        expect(typeof callArg.paymentMethodReturnUrl).toBe('string');
        // Finding #8: MP back_url points at the existing locale-prefixed
        // checkout success page, not the old /billing/return (which Astro
        // rewrote to a 404).
        expect(callArg.paymentMethodReturnUrl).toContain('/es/suscriptores/checkout/success/');
        const metadata = callArg.metadata as Record<string, unknown>;
        expect(metadata.source).toBe('start-paid-monthly');
    });

    it('falls back to the sandbox init point when provider init point is absent', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID,
                providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/xyz',
                providerSubscriptionIds: { mercadopago: 'mp_preapproval_xyz' }
            }
        });
        mockBilling(billing);

        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });

        expect(result.checkoutUrl).toBe('https://sandbox.mp.test/checkout/xyz');
    });

    it('returns 500 when neither init point is present (adapter misconfigured)', async () => {
        const billing = createBillingMock({
            subscription: {
                id: LOCAL_SUB_ID
            }
        });
        mockBilling(billing);

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 500 });
    });

    it('returns 404 when the plan slug is unknown', async () => {
        mockBilling(createBillingMock({ plans: [] }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'does-not-exist',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('returns 404 when the plan has no monthly price', async () => {
        // Plan exists but only annual pricing.
        mockBilling(
            createBillingMock({
                plans: [createPlan([ANNUAL_PRICE])]
            })
        );

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('skips inactive monthly prices', async () => {
        const inactiveMonthly: PriceFixture = { ...MONTHLY_PRICE, active: false };

        mockBilling(
            createBillingMock({
                plans: [createPlan([inactiveMonthly])]
            })
        );

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('ignores multi-month prices when looking for monthly', async () => {
        // A quarterly price (month/intervalCount=3) must not be selected as
        // the monthly price; the route should 404 here, not silently use it.
        const quarterly: PriceFixture = {
            id: 'price_quarterly',
            billingInterval: 'month',
            intervalCount: 3,
            active: true
        };

        mockBilling(
            createBillingMock({
                plans: [createPlan([quarterly])]
            })
        );

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 404 });
    });

    // The 501 placeholder for annual was removed in SPEC-141 D1;
    // annual now delegates to `initiatePaidAnnualSubscription` — see the
    // `handleStartPaidSubscription (annual)` describe block below.

    it('sums the plan base trial and FREEMONTH into ONE freeTrialDays', async () => {
        // FREEMONTH is a `trial_extension`: it LENGTHENS the trial the plan already
        // grants, it does not create one. It used to forward a flat 30 regardless;
        // card-first resolves base + promo ONCE (resolveCheckoutFreeTrialDays), so
        // the plan has to declare a trial for the extension to have anything to add
        // to — on a plan without one it grants nothing and reports promoCodeIgnored.
        const billing = createBillingMock({
            plans: [createPlan([MONTHLY_PRICE, ANNUAL_PRICE], TRIAL_METADATA)]
        });
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly',
            promoCode: 'FREEMONTH'
        });

        const callArg = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg.freeTrialDays).toBe(PLAN_TRIAL_DAYS + 30);
        const metadata = callArg.metadata as Record<string, unknown>;
        expect(metadata.promoCode).toBe('FREEMONTH');
    });

    it('returns 422 when an unknown promo code is supplied (INVALID_PROMO_CODE)', async () => {
        mockBilling(createBillingMock());

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly',
                promoCode: 'NOT_A_REAL_CODE'
            })
        ).rejects.toMatchObject({ status: 422 });
    });

    it('returns 503 when billing is disabled', async () => {
        mockBilling(null);
        const ctx = createMockContext({ billingEnabled: false });

        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 503 });
    });

    it('returns 503 when the billing client is not initialised', async () => {
        mockBilling(null);
        const ctx = createMockContext();

        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 503 });
    });

    it('returns 400 when the caller has no billing customer', async () => {
        mockBilling(createBillingMock());
        const ctx = createMockContext({ billingCustomerId: null });

        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 400 });
    });

    it('returns 500 when qzpay.subscriptions.create throws', async () => {
        mockBilling(
            createBillingMock({
                createThrows: new Error('MP timeout')
            })
        );

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 500 });
    });

    it('rejects an invalid promo code BEFORE creating the subscription', async () => {
        // The service resolves the promo code before calling qzpay so an
        // invalid code does not leave a half-created subscription behind.
        // For an UNKNOWN code, qzpay.subscriptions.create must not be hit;
        // billing.plans.list may still be called depending on the order of
        // checks in the service (currently promo is checked first).
        const billing = createBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly',
                promoCode: 'NOT_A_REAL_CODE'
            })
        ).rejects.toMatchObject({ status: 422 });

        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// checkout_started analytics (PostHog)
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — checkout_started analytics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('captures checkout_started with plan, interval, promo and price on a monthly checkout', async () => {
        const billing = createBillingMock({
            plans: [
                {
                    id: PLAN_ID,
                    name: 'owner-premium',
                    // unitAmount is centavos; the event normalizes to major units.
                    prices: [{ ...MONTHLY_PRICE, unitAmount: 500_000, currency: 'ARS' }]
                }
            ] as unknown as ReturnType<typeof createPlan>[]
        });
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });

        // HOS-122: `checkout_completed` is now ALSO captured after `result`
        // resolves, so the client's total call count is 2 (checkout_started +
        // checkout_completed) for any successful checkout, not 1. Filter to
        // `checkout_started` specifically to keep this assertion about the
        // event this describe block actually covers.
        const checkoutStartedCalls = mockPostHogCapture.mock.calls.filter(
            ([arg]) => (arg as { event?: string }).event === 'checkout_started'
        );
        expect(checkoutStartedCalls).toHaveLength(1);
        expect(mockPostHogCapture).toHaveBeenCalledWith({
            distinctId: 'user-1',
            event: 'checkout_started',
            properties: {
                planSlug: 'owner-premium',
                billingInterval: 'monthly',
                promoCode: null,
                // 500_000 centavos → 5_000 major units (ARS pesos), matching the
                // unit used by payment_failed / subscription_payment_succeeded.
                amount: 5_000,
                currency: 'ARS'
            }
        });
    });

    it('forwards the promo code into checkout_started when present', async () => {
        const billing = createBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly',
            promoCode: 'FREEMONTH'
        });

        const call = mockPostHogCapture.mock.calls.find(
            ([arg]) => (arg as { event?: string }).event === 'checkout_started'
        );
        expect((call?.[0] as { properties: { promoCode: string } }).properties.promoCode).toBe(
            'FREEMONTH'
        );
    });

    it('does not break the checkout when PostHog capture throws (defensive)', async () => {
        mockPostHogCapture.mockImplementationOnce(() => {
            throw new Error('posthog down');
        });
        const billing = createBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });

        // The checkout still completes despite the analytics failure.
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
    });
});

// ---------------------------------------------------------------------------
// Annual tests (SPEC-141 D1)
// ---------------------------------------------------------------------------

const ANNUAL_CUSTOMER_FIXTURE = {
    id: OWNER_CUSTOMER_ID,
    email: 'host@hospeda.test',
    name: 'Maria Rodriguez',
    livemode: false
};

interface AnnualBillingMockOptions {
    plans?: ReturnType<typeof createPlan>[];
    customer?: typeof ANNUAL_CUSTOMER_FIXTURE | null;
    subscription?: {
        id: string;
        providerInitPoint?: string;
        providerSandboxInitPoint?: string;
        providerSubscriptionIds?: { mercadopago?: string };
    } | null;
    createThrows?: Error;
    /** Existing subscriptions — non-empty disqualifies the customer from a trial. */
    priorSubscriptions?: unknown[];
}

/**
 * Billing mock for the annual route.
 *
 * HOS-171 §7.2 collapsed annual into the monthly mechanism: a RECURRING preapproval
 * at a 12-month cadence, created through `subscriptions.create` exactly like
 * monthly — not the one-time Checkout Pro charge it used to be. So this mirrors
 * `createBillingMock`; the annual-specific parts left are the price fixture and the
 * `billingInterval` the route must forward.
 *
 * `customers.get` survives only because the comp-promo branch reads `livemode` off
 * the customer. The plain annual path never calls it.
 */
function createAnnualBillingMock(opts: AnnualBillingMockOptions = {}) {
    const annualPriceWithAmount = {
        ...ANNUAL_PRICE,
        unitAmount: 35_000_000
    };
    const plans =
        opts.plans ??
        ([
            {
                id: PLAN_ID,
                name: 'owner-premium',
                prices: [annualPriceWithAmount]
            }
        ] as unknown as ReturnType<typeof createPlan>[]);
    const customer = opts.customer === undefined ? ANNUAL_CUSTOMER_FIXTURE : opts.customer;
    const subscription =
        opts.subscription === undefined
            ? {
                  id: LOCAL_SUB_ID,
                  providerInitPoint: 'https://mp.test/annual-abc',
                  providerSandboxInitPoint: 'https://sandbox.mp.test/annual-abc',
                  // HOS-151 Bug C: createPaidSubscription fails closed without one.
                  providerSubscriptionIds: { mercadopago: 'mp_preapproval_annual' }
              }
            : opts.subscription;

    const create = opts.createThrows
        ? vi.fn().mockRejectedValue(opts.createThrows)
        : vi.fn().mockResolvedValue(subscription);

    return {
        plans: { list: vi.fn().mockResolvedValue({ data: plans }) },
        customers: { get: vi.fn().mockResolvedValue(customer) },
        subscriptions: {
            // SPEC-147 T-008: getByCustomerId is called by the cancel-pending guard.
            // It is ALSO the HOS-171 one-trial-per-customer-for-life gate, so an
            // empty array means "trial-eligible" as well as "guard passes through".
            getByCustomerId: vi.fn().mockResolvedValue(opts.priorSubscriptions ?? []),
            create
        }
    };
}

describe('handleStartPaidSubscription (annual)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a recurring annual preapproval and returns the URL', async () => {
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        expect(result.checkoutUrl).toBe('https://mp.test/annual-abc');
        // The local row is inserted by the qzpay adapter inside subscriptions.create
        // now, so its id comes back from the provider response rather than being
        // minted here and hand-inserted.
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
        // Annual is the SAME call as monthly since HOS-171 — only the cadence differs.
        // It is no longer a one-time Checkout Pro charge.
        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.mode).toBe('paid');
        expect(call.billingInterval).toBe('annual');
        expect(call.priceId).toBe(ANNUAL_PRICE_ID);
    });

    it('passes the success back_url and notificationUrl from env', async () => {
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        // A preapproval has exactly ONE back_url, so the old cancelUrl and
        // statementDescriptor have no equivalent here — both died with the hosted
        // Checkout Pro page (HOS-171 §7.2).
        expect(call.paymentMethodReturnUrl).toBe(
            'https://hospeda.test/es/suscriptores/checkout/success/'
        );
        expect(call.notificationUrl).toBe(
            'https://api.hospeda.test/api/v1/webhooks/mercadopago?source_news=webhooks'
        );
    });

    it('returns 404 when the plan has no active annual price (NO_ANNUAL_PRICE)', async () => {
        mockBilling(
            createAnnualBillingMock({
                plans: [createPlan([MONTHLY_PRICE])] // monthly only
            })
        );

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'annual'
            })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('returns 500 when the preapproval carries no init point (MISSING_INIT_POINT)', async () => {
        mockBilling(
            createAnnualBillingMock({
                subscription: {
                    id: LOCAL_SUB_ID,
                    providerSubscriptionIds: { mercadopago: 'mp_preapproval_annual' }
                }
            })
        );

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'annual'
            })
        ).rejects.toMatchObject({ status: 500 });
    });

    it('returns 404 when the plan slug is unknown', async () => {
        mockBilling(createAnnualBillingMock({ plans: [] }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'does-not-exist',
                billingInterval: 'annual'
            })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('returns 503 when billing is not configured (shared short-circuit)', async () => {
        mockBilling(null);
        const ctx = createMockContext({ billingEnabled: false });

        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'annual'
            })
        ).rejects.toMatchObject({ status: 503 });
    });

    it('returns 400 when no billing customer is on session (shared short-circuit)', async () => {
        mockBilling(createAnnualBillingMock());
        const ctx = createMockContext({ billingCustomerId: null });

        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'annual'
            })
        ).rejects.toMatchObject({ status: 400 });
    });

    it('forwards the promoCode on annual — it is the same path as monthly now', async () => {
        // This assertion is INVERTED versus what it used to be. Annual ignored
        // promoCode entirely (SPEC-122 Decision 4) because it was a one-time
        // Checkout Pro charge and the promo engine only spoke preapproval. HOS-171
        // made annual the same preapproval as monthly, so it runs the same promo
        // resolution and the code reaches MercadoPago rather than being dropped.
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual',
            promoCode: 'FREEMONTH'
        });

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
        const call = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.promoCode).toBe('FREEMONTH');
    });
});

// ─── Locale resolution tests (SPEC-194 T-025) ──────────────────────────────────

describe('resolveReturnUrlLocale (_internals)', () => {
    it('returns "es" when user is null (no session)', () => {
        const ctx = createMockContext({ user: null });
        expect(_internals.resolveReturnUrlLocale(ctx as never)).toBe('es');
    });

    it('returns "es" when user has no settings', () => {
        const ctx = createMockContext({ user: {} });
        expect(_internals.resolveReturnUrlLocale(ctx as never)).toBe('es');
    });

    it('returns "es" when user.settings.languageWeb is absent', () => {
        const ctx = createMockContext({ user: { settings: { themeWeb: 'dark' } } });
        expect(_internals.resolveReturnUrlLocale(ctx as never)).toBe('es');
    });

    it('returns "en" when user.settings.languageWeb is "en"', () => {
        const ctx = createMockContext({ user: { settings: { languageWeb: 'en' } } });
        expect(_internals.resolveReturnUrlLocale(ctx as never)).toBe('en');
    });

    it('returns "pt" when user.settings.languageWeb is "pt"', () => {
        const ctx = createMockContext({ user: { settings: { languageWeb: 'pt' } } });
        expect(_internals.resolveReturnUrlLocale(ctx as never)).toBe('pt');
    });

    it('returns "es" when user.settings.languageWeb is an unsupported value', () => {
        const ctx = createMockContext({ user: { settings: { languageWeb: 'fr' } } });
        expect(_internals.resolveReturnUrlLocale(ctx as never)).toBe('es');
    });

    it('SUPPORTED_RETURN_URL_LOCALES contains es, en, pt', () => {
        expect(_internals.SUPPORTED_RETURN_URL_LOCALES).toContain('es');
        expect(_internals.SUPPORTED_RETURN_URL_LOCALES).toContain('en');
        expect(_internals.SUPPORTED_RETURN_URL_LOCALES).toContain('pt');
    });
});

describe('handleStartPaidSubscription — locale threading (SPEC-194 T-025)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('monthly: uses user locale in paymentMethodReturnUrl', async () => {
        const billing = createBillingMock();
        mockBilling(billing);

        const ctx = createMockContext({ user: { settings: { languageWeb: 'en' } } });
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });

        const callArg = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg.paymentMethodReturnUrl).toContain('/en/suscriptores/checkout/success/');
    });

    it('monthly: falls back to "es" when no user on context', async () => {
        const billing = createBillingMock();
        mockBilling(billing);

        const ctx = createMockContext({ user: null });
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });

        const callArg = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg.paymentMethodReturnUrl).toContain('/es/suscriptores/checkout/success/');
    });
});

// ---------------------------------------------------------------------------
// Provider error wiring tests (SPEC-149 T-004)
// ---------------------------------------------------------------------------

/**
 * Build a "stub shape" cause — numeric `status` property, mirrors
 * `buildHttpLikeError` in `test/e2e/helpers/mp-stub.ts`.
 */
function buildStubCause(status: number, code?: string): Error {
    const err = new Error(`Stub error ${status}`) as Error & {
        status: number;
        code?: string;
    };
    err.name = 'MpStubHttpError';
    err.status = status;
    if (code !== undefined) {
        err.code = code;
    }
    return err;
}

/**
 * Wrap a cause in a `QZPayProviderSyncError` (thrown when
 * `providerSyncErrorStrategy: 'throw'`).
 */
function buildProviderSyncError(
    cause?: Error,
    operation = 'subscription_create'
): QZPayProviderSyncError {
    return new QZPayProviderSyncError(
        'Failed in mercadopago',
        'mercadopago',
        operation,
        { customerId: 'cust_test' },
        cause
    );
}

describe('handleStartPaidSubscription — provider error wiring (SPEC-149 T-004)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-establish the captureBillingError mock after clearAllMocks wipes it.
        vi.mocked(captureBillingError).mockReturnValue('sentinel-event-id');
    });

    // ── Monthly path ─────────────────────────────────────────────────────────
    //
    // WIRING TESTS — important context (M1 reconciliation, SPEC-149 adversarial review):
    //
    // qzpay-core's `subscriptions.create` re-throws RAW adapter errors, NOT wrapped
    // in `QZPayProviderSyncError`. The monthly path therefore falls through to the
    // generic catch block and returns HTTP 500 in production — the PROVIDER_* mapping
    // in the catch block IS reachable but only when a synthetic wrapped error is injected
    // by a test, NOT by the live monthly adapter path.
    //
    // These tests exercise the catch-block WIRING (isBillingProviderError → mapProviderError
    // → captureBillingError → throw ServiceError) and are valuable regression guards for that
    // code path. They are NOT representative of the live monthly checkout flow until
    // qzpay-core wraps subscriptions.create errors in QZPayProviderSyncError.
    //
    // See also: test/e2e/flows/billing/monthly-checkout.test.ts:316-352 and
    // test/e2e/flows/billing/mp-error-handling.test.ts:25-31 which pin the REAL
    // monthly behavior (raw error → 500).

    it('monthly (WIRING): QZPayProviderSyncError 429 → ServiceError PROVIDER_RATE_LIMITED via catch block', async () => {
        // WIRING TEST: exercises the catch block with a synthetic wrapped error.
        // NOT representative of live monthly path — subscriptions.create re-throws raw errors.
        const providerErr = buildProviderSyncError(buildStubCause(429, 'RATE_LIMITED'));
        mockBilling(createBillingMock({ createThrows: providerErr }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toSatisfy(
            (err: unknown) =>
                err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_RATE_LIMITED
        );
    });

    it('monthly (WIRING): QZPayProviderSyncError 408 timeout → ServiceError PROVIDER_TIMEOUT via catch block', async () => {
        // WIRING TEST: exercises the catch block with a synthetic wrapped error.
        // NOT representative of live monthly path — subscriptions.create re-throws raw errors.
        const providerErr = buildProviderSyncError(buildStubCause(408, 'TIMEOUT'));
        mockBilling(createBillingMock({ createThrows: providerErr }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toSatisfy(
            (err: unknown) =>
                err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_TIMEOUT
        );
    });

    it('monthly (WIRING): QZPayProviderSyncError 500 → ServiceError PROVIDER_ERROR via catch block', async () => {
        // WIRING TEST: exercises the catch block with a synthetic wrapped error.
        // NOT representative of live monthly path — subscriptions.create re-throws raw errors.
        const providerErr = buildProviderSyncError(buildStubCause(500, 'SERVER_ERROR'));
        mockBilling(createBillingMock({ createThrows: providerErr }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toSatisfy(
            (err: unknown) =>
                err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_ERROR
        );
    });

    it('monthly (WIRING): QZPayProviderSyncError 422 → ServiceError VALIDATION_ERROR via catch block', async () => {
        // WIRING TEST: exercises the catch block with a synthetic wrapped error.
        // NOT representative of live monthly path — subscriptions.create re-throws raw errors.
        const providerErr = buildProviderSyncError(buildStubCause(422, 'INVALID_CARD'));
        mockBilling(createBillingMock({ createThrows: providerErr }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toSatisfy(
            (err: unknown) =>
                err instanceof ServiceError && err.code === ServiceErrorCode.VALIDATION_ERROR
        );
    });

    it('monthly (WIRING): captureBillingError called with operation=start_paid_checkout, customerId, planId, providerStatus on wrapped 429', async () => {
        // WIRING TEST: exercises captureBillingError call shape with a synthetic wrapped error.
        // NOT representative of live monthly path — subscriptions.create re-throws raw errors.
        const providerErr = buildProviderSyncError(buildStubCause(429, 'RATE_LIMITED'));
        mockBilling(createBillingMock({ createThrows: providerErr }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toBeInstanceOf(ServiceError);

        expect(vi.mocked(captureBillingError)).toHaveBeenCalledTimes(1);
        const [capturedErr, capturedCtx] = vi.mocked(captureBillingError).mock.calls[0] ?? [];
        expect(capturedErr).toBeInstanceOf(ServiceError);
        expect(capturedCtx).toMatchObject({
            operation: 'start_paid_checkout',
            providerStatus: 429
        });
        // customerId and planId should NOT be email/PII — just IDs.
        expect(capturedCtx).toHaveProperty('planId');
    });

    it('monthly (WIRING): captureBillingError called once on wrapped MP 500 with correct providerStatus', async () => {
        // WIRING TEST: exercises captureBillingError call shape with a synthetic wrapped error.
        // NOT representative of live monthly path — subscriptions.create re-throws raw errors.
        const providerErr = buildProviderSyncError(buildStubCause(500));
        mockBilling(createBillingMock({ createThrows: providerErr }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toBeInstanceOf(ServiceError);

        expect(vi.mocked(captureBillingError)).toHaveBeenCalledTimes(1);
        const [, capturedCtx] = vi.mocked(captureBillingError).mock.calls[0] ?? [];
        expect(capturedCtx).toMatchObject({ providerStatus: 500 });
    });

    // ── Monthly path: raw error fall-through (pins real production behavior) ──

    it('monthly (REAL BEHAVIOR): raw Error from subscriptions.create falls through to HTTPException 500, captureBillingError NOT called', async () => {
        // This test pins the ACTUAL live monthly path:
        // qzpay-core subscriptions.create re-throws raw adapter errors, NOT wrapped
        // in QZPayProviderSyncError. The route catch block does NOT recognize raw errors
        // as provider errors → falls through to the generic HTTPException(500) re-throw.
        // captureBillingError is NOT called on this path (no PROVIDER_* mapping fires).
        //
        // This behavior persists until qzpay-core wraps subscriptions.create errors
        // in QZPayProviderSyncError. When that happens, this test should be updated
        // (the raw error path will no longer reach the generic catch).
        //
        // Mirrors: test/e2e/flows/billing/monthly-checkout.test.ts:316-352 and
        //          test/e2e/flows/billing/mp-error-handling.test.ts:25-31
        const rawMpError = new Error('MP raw error: rate_limit');
        // NOT a QZPayProviderSyncError — this is what subscriptions.create actually throws
        mockBilling(createBillingMock({ createThrows: rawMpError }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 500 });

        // captureBillingError is NOT called for raw non-provider errors on the monthly path
        expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
    });

    // ── Annual path ──────────────────────────────────────────────────────────

    it('annual: MP 429 → ServiceError PROVIDER_RATE_LIMITED (not generic 500)', async () => {
        const providerErr = buildProviderSyncError(
            buildStubCause(429, 'RATE_LIMITED'),
            'checkout_create'
        );
        const billing = createAnnualBillingMock();
        billing.subscriptions.create = vi.fn().mockRejectedValue(providerErr);
        mockBilling(billing);

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'annual'
            })
        ).rejects.toSatisfy(
            (err: unknown) =>
                err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_RATE_LIMITED
        );
    });

    it('annual: MP 500 → ServiceError PROVIDER_ERROR', async () => {
        const providerErr = buildProviderSyncError(buildStubCause(500), 'checkout_create');
        const billing = createAnnualBillingMock();
        billing.subscriptions.create = vi.fn().mockRejectedValue(providerErr);
        mockBilling(billing);

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'annual'
            })
        ).rejects.toSatisfy(
            (err: unknown) =>
                err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_ERROR
        );
    });

    it('annual: captureBillingError called with operation=start_paid_checkout and providerStatus on 429', async () => {
        const providerErr = buildProviderSyncError(buildStubCause(429), 'checkout_create');
        const billing = createAnnualBillingMock();
        billing.subscriptions.create = vi.fn().mockRejectedValue(providerErr);
        mockBilling(billing);

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'annual'
            })
        ).rejects.toBeInstanceOf(ServiceError);

        expect(vi.mocked(captureBillingError)).toHaveBeenCalledTimes(1);
        const [, capturedCtx] = vi.mocked(captureBillingError).mock.calls[0] ?? [];
        expect(capturedCtx).toMatchObject({
            operation: 'start_paid_checkout',
            providerStatus: 429
        });
    });

    // ── Regression guard: non-provider errors still go the OLD path ──────────

    it('regression: plain Error (non-provider) still throws HTTPException 500', async () => {
        const plainError = new Error('unexpected DB blowup');
        mockBilling(createBillingMock({ createThrows: plainError }));

        const ctx = createMockContext();
        const caught = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        // Must be HTTPException (not ServiceError) — old path still works.
        expect(caught).not.toBeInstanceOf(ServiceError);
        expect(caught).toMatchObject({ status: 500 });
        // captureBillingError must NOT be called for non-provider errors.
        expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
    });

    it('regression: SubscriptionCheckoutError still maps via mapServiceErrorToHttp', async () => {
        // PLAN_NOT_FOUND → 404 (existing path must remain intact)
        mockBilling(createBillingMock({ plans: [] }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'no-such-plan',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 404 });

        expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// No server-side retry pinning (SPEC-149 descope pin)
//
// Part D of SPEC-149 (server-side retry on transient provider errors) was
// DESCOPED during the spec realign.  Reason: the idempotency middleware does
// not cache in-flight requests, so a naive server-side retry would hit the
// provider a second time before the first request is known to have failed —
// creating a double-charge risk.
//
// The replacement deliverable is this pinning suite: assert that on a
// retryable provider error (429 / timeout / 5xx) the server performs EXACTLY
// ONE provider call per request.  If anyone later adds retries, these tests
// fail and force them to confront the idempotency problem before merging.
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — no server-side retry (SPEC-149 descope pin)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(captureBillingError).mockReturnValue('sentinel-event-id');
    });

    it('monthly: billing.subscriptions.create called exactly once on MP 429 (no retry)', async () => {
        const providerErr = buildProviderSyncError(buildStubCause(429, 'RATE_LIMITED'));
        const billing = createBillingMock({ createThrows: providerErr });
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        }).catch(() => undefined);

        // Exactly one provider call — no retry loop.
        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });

    it('monthly: billing.subscriptions.create called exactly once on MP 503 (no retry)', async () => {
        const providerErr = buildProviderSyncError(buildStubCause(503, 'SERVICE_UNAVAILABLE'));
        const billing = createBillingMock({ createThrows: providerErr });
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        }).catch(() => undefined);

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });

    it('monthly: billing.subscriptions.create called exactly once on MP 408 timeout (no retry)', async () => {
        const providerErr = buildProviderSyncError(buildStubCause(408, 'TIMEOUT'));
        const billing = createBillingMock({ createThrows: providerErr });
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        }).catch(() => undefined);

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });

    it('annual: the preapproval create is called exactly once on MP 429 (no retry)', async () => {
        const providerErr = buildProviderSyncError(
            buildStubCause(429, 'RATE_LIMITED'),
            'checkout_create'
        );
        const billing = createAnnualBillingMock();
        billing.subscriptions.create = vi.fn().mockRejectedValue(providerErr);
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        }).catch(() => undefined);

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });

    it('annual: the preapproval create is called exactly once on MP 503 (no retry)', async () => {
        const providerErr = buildProviderSyncError(
            buildStubCause(503, 'SERVICE_UNAVAILABLE'),
            'checkout_create'
        );
        const billing = createAnnualBillingMock();
        billing.subscriptions.create = vi.fn().mockRejectedValue(providerErr);
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        }).catch(() => undefined);

        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// HOS-115 T-012 — checkout_started analytics for the annual trial branch
// (AC-10 / OQ-2: "reuse the existing event" — no new event/property).
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — checkout_started analytics on the ANNUAL trial branch (HOS-115 T-012)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * A trial-declaring annual plan + a fully-wired billing mock so the
     * request drives ALL THE WAY through `initiatePaidAnnualSubscription`'s
     * TRIAL branch (COMP check -> plan-level hasTrial/trialDays -> zero-prior
     * -subs eligibility -> `TrialService.startTrial()`), exactly like the
     * route-level e2e coverage in
     * `test/e2e/flows/billing/annual-trial-checkout.test.ts`, but here fully
     * mocked so we can inspect the `checkout_started` PostHog capture in
     * isolation.
     */
    function createAnnualTrialBillingMock() {
        const trialPlan = {
            id: PLAN_ID,
            name: 'owner-premium',
            prices: [{ ...ANNUAL_PRICE, unitAmount: 5_000_000, currency: 'ARS' }],
            // resolvePlanTrialConfig() reads these two fields off plan.metadata.
            metadata: { hasTrial: true, trialDays: 14 }
        } as unknown as ReturnType<typeof createPlan>;

        // A card-first trial IS a real MercadoPago preapproval: the card is taken on
        // day 1 and only the first CHARGE is deferred. So it comes back with an init
        // point and a provider id like any paid checkout — it used to be a no-card
        // subscription with neither, which is why this shape had to change.
        const trialSubscription = {
            id: 'trial-sub-annual-1',
            status: 'trialing',
            trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            providerInitPoint: 'https://mp.test/checkout/trial-preapproval',
            providerSubscriptionIds: { mercadopago: 'mp_preapproval_trial' }
        };

        return {
            plans: { list: vi.fn().mockResolvedValue({ data: [trialPlan] }) },
            customers: { get: vi.fn().mockResolvedValue(ANNUAL_CUSTOMER_FIXTURE) },
            subscriptions: {
                // No prior subscriptions -> trial-eligible.
                getByCustomerId: vi.fn().mockResolvedValue([]),
                create: vi.fn().mockResolvedValue(trialSubscription),
                get: vi.fn().mockResolvedValue(trialSubscription)
            }
        };
    }

    it('AC-10: a trial-eligible ANNUAL checkout resolves appliedEffect="trial", but checkout_started (captured BEFORE the trial/paid decision) does NOT currently carry appliedEffect', async () => {
        // ARRANGE — a trial-eligible customer on a trial-declaring plan,
        // selecting the ANNUAL toggle. This must resolve to the TRIAL branch
        // (verified independently below), matching AC-1/AC-10's premise.
        const billing = createAnnualTrialBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();

        // ACT
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        // SANITY — the checkout really did resolve to the trial branch (no MP
        // checkout object created), establishing the premise AC-10 is about.
        // A trial is no longer an `appliedEffect`: it is an ordinary paid preapproval
        // with the first charge deferred, so it carries `trialGranted` instead and
        // takes the normal MP redirect. The `outcome` assertion below is unchanged —
        // the analytics contract this AC pins survives, only its carrier moved.
        expect(result.trialGranted).toBe(true);
        expect(result.appliedEffect).toBeUndefined();

        // ASSERT — checkout_started WAS captured, with billingInterval='annual'
        // (the part of AC-10 the current implementation satisfies).
        // HOS-122: `checkout_completed` is now ALSO captured after `result`
        // resolves (this trial checkout resolves successfully), so the total
        // call count is 2. Filter to `checkout_started` specifically — this
        // describe block only pins that event's (unchanged) shape.
        const checkoutStartedCalls = mockPostHogCapture.mock.calls.filter(
            ([arg]) => (arg as { event?: string }).event === 'checkout_started'
        );
        expect(checkoutStartedCalls).toHaveLength(1);
        const call = mockPostHogCapture.mock.calls.find(
            ([arg]) => (arg as { event?: string }).event === 'checkout_started'
        );
        expect(call).toBeDefined();
        const properties = (call?.[0] as { properties: Record<string, unknown> }).properties;
        expect(properties.billingInterval).toBe('annual');

        // FINDING (HOS-115 gap vs spec.md AC-10 / OQ-2): `checkout_started` is
        // captured in start-paid.ts BEFORE `initiatePaidAnnualSubscription` is
        // invoked (the capture block runs first, then `result = await
        // initiatePaidAnnualSubscription(...)` — see start-paid.ts ~L361-424).
        // At capture time the trial-vs-paid decision has not been made yet, so
        // `appliedEffect` is NEVER included in the event payload for EITHER
        // interval, not just annual. AC-10 requires
        // `billingInterval='annual' AND appliedEffect='trial'` on the SAME
        // captured event -- that is not what the current code does.
        //
        // This assertion pins the ACTUAL (gap) behavior rather than the
        // spec'd one, per this task's test-only scope (no source changes):
        // `appliedEffect` is absent from the captured properties even though
        // the checkout itself resolved to a trial.
        expect(properties).not.toHaveProperty('appliedEffect');
    });
});

// ---------------------------------------------------------------------------
// HOS-122 — checkout_completed outcome analytics (AC-1..AC-7, D-10)
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — checkout_completed outcome analytics (HOS-122)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Finds a specific PostHog capture call by event name among ALL calls
     * made during a test (both `checkout_started` and `checkout_completed`
     * are captured on every successful checkout since HOS-122).
     */
    function findCapturedEvent(eventName: string) {
        const call = mockPostHogCapture.mock.calls.find(
            ([arg]) => (arg as { event?: string }).event === eventName
        );
        return call?.[0] as
            | { distinctId: string; event: string; properties: Record<string, unknown> }
            | undefined;
    }

    // Mirrors T-012's `createAnnualTrialBillingMock` (that helper is local to
    // its own describe block, so it is not reachable from here) — same shape,
    // reused for AC-1 / AC-4 / D-10 / AC-6's trial-flavoured cases.
    function createAnnualTrialBillingMock() {
        const trialPlan = {
            id: PLAN_ID,
            name: 'owner-premium',
            prices: [{ ...ANNUAL_PRICE, unitAmount: 5_000_000, currency: 'ARS' }],
            metadata: { hasTrial: true, trialDays: 14 }
        } as unknown as ReturnType<typeof createPlan>;

        // A card-first trial IS a real MercadoPago preapproval: the card is taken on
        // day 1 and only the first CHARGE is deferred. So it comes back with an init
        // point and a provider id like any paid checkout — it used to be a no-card
        // subscription with neither, which is why this shape had to change.
        const trialSubscription = {
            id: 'trial-sub-annual-hos122-1',
            status: 'trialing',
            trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            providerInitPoint: 'https://mp.test/checkout/trial-preapproval',
            providerSubscriptionIds: { mercadopago: 'mp_preapproval_trial' }
        };

        return {
            plans: { list: vi.fn().mockResolvedValue({ data: [trialPlan] }) },
            customers: { get: vi.fn().mockResolvedValue(ANNUAL_CUSTOMER_FIXTURE) },
            subscriptions: {
                getByCustomerId: vi.fn().mockResolvedValue([]),
                create: vi.fn().mockResolvedValue(trialSubscription),
                get: vi.fn().mockResolvedValue(trialSubscription)
            }
        };
    }

    // Monthly mirror of the helper above (AC-3).
    function createMonthlyTrialBillingMock() {
        const trialPlan = {
            id: PLAN_ID,
            name: 'owner-premium',
            prices: [{ ...MONTHLY_PRICE, unitAmount: 500_000, currency: 'ARS' }],
            metadata: { hasTrial: true, trialDays: 14 }
        } as unknown as ReturnType<typeof createPlan>;

        // A card-first trial IS a real MercadoPago preapproval: the card is taken on
        // day 1 and only the first CHARGE is deferred. So it comes back with an init
        // point and a provider id like any paid checkout — it used to be a no-card
        // subscription with neither, which is why this shape had to change.
        const trialSubscription = {
            id: 'trial-sub-monthly-hos122-1',
            status: 'trialing',
            trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            providerInitPoint: 'https://mp.test/checkout/trial-preapproval',
            providerSubscriptionIds: { mercadopago: 'mp_preapproval_trial' }
        };

        return {
            plans: { list: vi.fn().mockResolvedValue({ data: [trialPlan] }) },
            customers: { get: vi.fn().mockResolvedValue(ANNUAL_CUSTOMER_FIXTURE) },
            subscriptions: {
                getByCustomerId: vi.fn().mockResolvedValue([]),
                create: vi.fn().mockResolvedValue(trialSubscription),
                get: vi.fn().mockResolvedValue(trialSubscription)
            }
        };
    }

    it('AC-1: a trial-eligible ANNUAL checkout emits checkout_completed with billingInterval="annual" and outcome="trial"', async () => {
        // ARRANGE
        const billing = createAnnualTrialBillingMock();
        mockBilling(billing);

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        // ASSERT
        // A trial is no longer an `appliedEffect`: it is an ordinary paid preapproval
        // with the first charge deferred, so it carries `trialGranted` instead and
        // takes the normal MP redirect. The `outcome` assertion below is unchanged —
        // the analytics contract this AC pins survives, only its carrier moved.
        expect(result.trialGranted).toBe(true);
        expect(result.appliedEffect).toBeUndefined();
        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeDefined();
        expect(completed?.properties.billingInterval).toBe('annual');
        expect(completed?.properties.outcome).toBe('trial');
    });

    it('AC-2: a plain paid ANNUAL checkout (not trial-eligible, no promo) emits checkout_completed with outcome="paid", never absent', async () => {
        // ARRANGE — default annual mock: no trial metadata on the plan, no
        // promo code -> falls straight through to the paid branch.
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        // ASSERT
        expect(result.appliedEffect).toBeUndefined();
        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeDefined();
        expect(completed?.properties.billingInterval).toBe('annual');
        expect(completed?.properties).toHaveProperty('outcome');
        expect(completed?.properties.outcome).toBe('paid');
    });

    it('AC-3: a plain paid MONTHLY checkout emits checkout_completed with billingInterval="monthly" and outcome="paid" (mirrors AC-2)', async () => {
        // ARRANGE
        const billing = createBillingMock();
        mockBilling(billing);

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });

        // ASSERT
        expect(result.appliedEffect).toBeUndefined();
        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeDefined();
        expect(completed?.properties.billingInterval).toBe('monthly');
        expect(completed?.properties.outcome).toBe('paid');
    });

    it('AC-3: a trial-eligible MONTHLY checkout emits checkout_completed with billingInterval="monthly" and outcome="trial" (mirrors AC-1)', async () => {
        // ARRANGE
        const billing = createMonthlyTrialBillingMock();
        mockBilling(billing);

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly'
        });

        // ASSERT
        // A trial is no longer an `appliedEffect`: it is an ordinary paid preapproval
        // with the first charge deferred, so it carries `trialGranted` instead and
        // takes the normal MP redirect. The `outcome` assertion below is unchanged —
        // the analytics contract this AC pins survives, only its carrier moved.
        expect(result.trialGranted).toBe(true);
        expect(result.appliedEffect).toBeUndefined();
        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeDefined();
        expect(completed?.properties.billingInterval).toBe('monthly');
        expect(completed?.properties.outcome).toBe('trial');
    });

    it('AC-4: a comp promo checkout emits checkout_completed with outcome="comp"', async () => {
        // ARRANGE — the comp branch requires DB query shapes
        // (`select().from(billingPlans)`, `withTransaction`) this file's
        // `@repo/db` mock does not carry, so the SERVICE call itself is
        // overridden for this one call (see the vi.mock comment above); the
        // billing mock still backs the route's OWN pre-checks (plan lookup,
        // existing-subscriptions guard) that run before the service call.
        const billing = createAnnualBillingMock();
        mockBilling(billing);
        mockInitiatePaidAnnualSubscription.mockResolvedValueOnce({
            checkoutUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
            localSubscriptionId: 'comp-sub-hos122-1',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            appliedEffect: 'comp'
        });

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual',
            promoCode: 'FREEFOREVER'
        });

        // ASSERT
        expect(result.appliedEffect).toBe('comp');
        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeDefined();
        expect(completed?.properties.outcome).toBe('comp');
        expect(completed?.properties.localSubscriptionId).toBe('comp-sub-hos122-1');
    });

    it('AC-4: a signup-discount checkout emits checkout_completed with outcome="discount"', async () => {
        // ARRANGE — same rationale as the comp case above: the discount
        // branch mutates a live MP preapproval and reads the full plan price
        // from the DB, both outside this file's mock surface, so the service
        // call is overridden for this one call.
        const billing = createBillingMock();
        mockBilling(billing);
        mockInitiatePaidMonthlySubscription.mockResolvedValueOnce({
            checkoutUrl: 'https://mp.test/checkout/discounted',
            localSubscriptionId: 'discount-sub-hos122-1',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            appliedEffect: 'discount'
        });

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly',
            promoCode: 'SAVE10'
        });

        // ASSERT
        expect(result.appliedEffect).toBe('discount');
        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeDefined();
        expect(completed?.properties.outcome).toBe('discount');
    });

    it('AC-4: a trial checkout that ALSO gets a discount keeps both, and the event reports both', async () => {
        // ARRANGE — a trial-eligible annual checkout that ALSO supplies a
        // `discount` code.
        //
        // This AC is INVERTED versus what it pinned. It used to assert the trial
        // DISCARDED the discount (promoCodeIgnored: true) because the trial "won"
        // on a not-yet-charged subscription. HOS-171 reversed that: the two
        // coexist — the trial defers the first charge, the discount lowers what
        // that charge will be. The old rule left a first-time owner, the only
        // customer who gets a trial, unable to use a discount code at all.
        const billing = createAnnualTrialBillingMock();
        mockBilling(billing);
        vi.mocked(resolveCheckoutPromoPlan).mockResolvedValueOnce({
            kind: 'discount',
            promoCodeId: 'promo-hos122-1',
            code: 'SAVE10',
            effect: {
                kind: PromoEffectKindEnum.DISCOUNT,
                valueKind: ValueKindEnum.PERCENTAGE,
                value: 10,
                durationCycles: null
            }
        });

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual',
            promoCode: 'SAVE10'
        });

        // ASSERT — both effects land, and nothing is reported as ignored.
        expect(result.trialGranted).toBe(true);
        expect(result.appliedEffect).toBe('discount');
        expect(result.promoCodeIgnored).toBeUndefined();

        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeDefined();
        // `outcome` is a scalar and reports what the money did. The trial is not
        // lost with it — it rides its own dimension, which is the whole reason
        // `trialGranted` exists on the event.
        expect(completed?.properties.outcome).toBe('discount');
        expect(completed?.properties.trialGranted).toBe(true);
        expect(completed?.properties.promoCodeIgnored).toBe(false);
    });

    it('AC-5: checkout_started stays without appliedEffect/outcome once checkout_completed also fires', async () => {
        // ARRANGE — regression guard, complementing the pinned T-012 test:
        // makes the AC-5 invariant explicit inside the HOS-122 describe block
        // itself (adding checkout_completed must never leak appliedEffect /
        // outcome onto checkout_started).
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        // ACT
        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        // ASSERT
        const started = findCapturedEvent('checkout_started');
        expect(started).toBeDefined();
        expect(started?.properties).not.toHaveProperty('appliedEffect');
        expect(started?.properties).not.toHaveProperty('outcome');
    });

    it('AC-6: checkout_completed and checkout_started share distinctId + billingInterval and are joinable via localSubscriptionId', async () => {
        // ARRANGE
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        // ASSERT
        const started = findCapturedEvent('checkout_started');
        const completed = findCapturedEvent('checkout_completed');
        expect(started).toBeDefined();
        expect(completed).toBeDefined();
        expect(started?.distinctId).toBe('user-1');
        expect(completed?.distinctId).toBe('user-1');
        expect(started?.properties.billingInterval).toBe('annual');
        expect(completed?.properties.billingInterval).toBe('annual');
        expect(completed?.properties.localSubscriptionId).toBe(result.localSubscriptionId);
    });

    it('AC-7: checkout still succeeds and no error propagates when the checkout_completed PostHog capture throws', async () => {
        // ARRANGE — let checkout_started succeed normally, throw only on the
        // SECOND capture call (checkout_completed).
        const billing = createAnnualBillingMock();
        mockBilling(billing);
        mockPostHogCapture.mockImplementationOnce(() => undefined); // checkout_started
        mockPostHogCapture.mockImplementationOnce(() => {
            throw new Error('posthog down (checkout_completed)');
        });

        // ACT
        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        // ASSERT — checkout still completed successfully; the thrown analytics
        // error never propagated out of the handler.
        expect(result.checkoutUrl).toBe('https://mp.test/annual-abc');
        expect(typeof result.localSubscriptionId).toBe('string');
    });

    it('AC-7: no checkout_completed is emitted when initiatePaidMonthlySubscription throws before `result` resolves', async () => {
        // ARRANGE — unknown plan slug -> PLAN_NOT_FOUND is thrown INSIDE
        // initiatePaidMonthlySubscription, after checkout_started already
        // fired at the route level.
        mockBilling(createBillingMock({ plans: [] }));

        // ACT
        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'does-not-exist',
                billingInterval: 'monthly'
            })
        ).rejects.toMatchObject({ status: 404 });

        // ASSERT — checkout_started still fires (attempt signal survives the
        // error)...
        const started = findCapturedEvent('checkout_started');
        expect(started).toBeDefined();
        // ...but checkout_completed must NOT be captured: `result` never
        // resolved, so the route never reaches the post-decision try block.
        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeUndefined();
    });

    it('D-10: $set persists last_checkout_outcome equal to the resolved outcome', async () => {
        // ARRANGE — trial outcome, so this also cross-checks D-10 against a
        // non-"paid" value (not just the default fallback).
        const billing = createAnnualTrialBillingMock();
        mockBilling(billing);

        // ACT
        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        // ASSERT
        const completed = findCapturedEvent('checkout_completed');
        expect(completed).toBeDefined();
        expect(completed?.properties.$set).toEqual({ last_checkout_outcome: 'trial' });
    });
});

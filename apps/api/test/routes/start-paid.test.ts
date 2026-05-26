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
        billingSubscriptions: { __table: 'billing_subscriptions' }
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../src/middlewares/billing';
import { handleStartPaidSubscription } from '../../src/routes/billing/start-paid';

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
}

function createMockContext(opts: ContextOptions = {}) {
    const { billingEnabled = true, billingCustomerId = OWNER_CUSTOMER_ID } = opts;

    const store = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
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

function createPlan(prices: PriceFixture[]) {
    return {
        id: PLAN_ID,
        name: 'owner-premium',
        prices
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
                  providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/abc'
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
            notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
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
                providerSandboxInitPoint: 'https://sandbox.mp.test/checkout/xyz'
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

    it('accepts the FREEMONTH promo and forwards freeTrialDays to qzpay (D9)', async () => {
        const billing = createBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'monthly',
            promoCode: 'FREEMONTH'
        });

        const callArg = billing.subscriptions.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg.freeTrialDays).toBe(30);
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
    checkoutResult?: {
        id?: string;
        providerInitPoint?: string;
        providerSandboxInitPoint?: string;
    } | null;
}

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
    const checkoutResult =
        opts.checkoutResult === undefined
            ? { id: 'checkout-1', providerInitPoint: 'https://mp.test/annual-abc' }
            : opts.checkoutResult;

    return {
        plans: { list: vi.fn().mockResolvedValue({ data: plans }) },
        customers: { get: vi.fn().mockResolvedValue(customer) },
        checkout: { create: vi.fn().mockResolvedValue(checkoutResult) },
        // Stub for monthly fallback path — never invoked in annual tests.
        subscriptions: { create: vi.fn() }
    };
}

describe('handleStartPaidSubscription (annual)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates an annual subscription via billing.checkout (mode=payment) and returns the URL', async () => {
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        expect(result.checkoutUrl).toBe('https://mp.test/annual-abc');
        expect(typeof result.localSubscriptionId).toBe('string');
        expect(result.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(billing.checkout.create).toHaveBeenCalledTimes(1);
        // Monthly path must NOT be invoked when interval is annual.
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('passes successUrl, cancelUrl, notificationUrl and statementDescriptor from env', async () => {
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual'
        });

        const call = billing.checkout.create.mock.calls[0]?.[0] as Record<string, unknown>;
        // Finding #8: annual back_urls point at the existing locale-prefixed
        // checkout pages (success/failure), not the old /billing/return.
        expect(call.successUrl).toBe('https://hospeda.test/es/suscriptores/checkout/success/');
        expect(call.cancelUrl).toBe('https://hospeda.test/es/suscriptores/checkout/failure/');
        expect(call.notificationUrl).toBe('https://api.hospeda.test/api/v1/webhooks/mercadopago');
        expect(call.statementDescriptor).toBe('HOSPEDA');
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

    it('returns 404 when the customer cannot be resolved (CUSTOMER_NOT_FOUND)', async () => {
        mockBilling(createAnnualBillingMock({ customer: null }));

        const ctx = createMockContext();
        await expect(
            handleStartPaidSubscription(ctx as never, {
                planSlug: 'owner-premium',
                billingInterval: 'annual'
            })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('returns 500 when checkout returns no init point (MISSING_INIT_POINT)', async () => {
        mockBilling(
            createAnnualBillingMock({
                checkoutResult: { id: 'checkout-empty' }
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

    it('promoCode is ignored on annual (only forwarded by the monthly path)', async () => {
        const billing = createAnnualBillingMock();
        mockBilling(billing);

        const ctx = createMockContext();
        await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-premium',
            billingInterval: 'annual',
            promoCode: 'FREEMONTH'
        });

        // billing.checkout was called (success) — annual ignores promoCode
        // entirely (Decision 4 of SPEC-122: discount-type promos out of MVP).
        expect(billing.checkout.create).toHaveBeenCalledTimes(1);
    });
});

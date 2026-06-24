/**
 * SPEC-262 H2 guard tests: start-paid rejected when the customer already has
 * an active/trialing/comp accommodation subscription.
 *
 * Stacking a new subscription on top of an existing active one creates
 * ambiguous entitlements (two subs for the same customer). The guard must fire
 * BEFORE any provider call.
 *
 * @module test/routes/billing/start-paid-already-subscribed
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'user-1', email: 'test@test.com', roles: [] }))
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
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
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
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handleStartPaidSubscription } from '../../../src/routes/billing/start-paid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_h2_test';
const PLAN_SLUG = 'owner-basico';

function makeContext() {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        // Better Auth session user (for resolveReturnUrlLocale)
        var: { user: null }
    };
}

function makeBillingMock(existingSubs: { status: string; cancelAtPeriodEnd?: boolean }[]) {
    const plan = {
        id: 'plan-basico',
        name: PLAN_SLUG,
        active: true,
        prices: [
            { id: 'price-m', billingInterval: 'month', intervalCount: 1, active: true },
            { id: 'price-y', billingInterval: 'year', intervalCount: 1, active: true }
        ],
        metadata: {}
    };
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(existingSubs),
            create: vi.fn()
        },
        plans: { list: vi.fn().mockResolvedValue({ data: [plan] }) }
    };
}

function mockBillingWith(billing: ReturnType<typeof makeBillingMock>) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests — SPEC-262 H2 guard
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — ALREADY_SUBSCRIBED guard (SPEC-262 H2)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('throws ALREADY_EXISTS when customer has an active accommodation sub', async () => {
        mockBillingWith(makeBillingMock([{ status: 'active' }]));
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('throws ALREADY_EXISTS when customer has a trialing sub', async () => {
        mockBillingWith(makeBillingMock([{ status: 'trialing' }]));
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('throws ALREADY_EXISTS when customer has a comp sub (SPEC-262 — comp subs are perpetual)', async () => {
        mockBillingWith(makeBillingMock([{ status: 'comp' }]));
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'annual'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('provider.subscriptions.create NOT called when ALREADY_SUBSCRIBED guard fires', async () => {
        const billing = makeBillingMock([{ status: 'active' }]);
        mockBillingWith(billing);
        const ctx = makeContext();

        await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch(() => undefined);

        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('allows checkout when no existing subs', async () => {
        const billing = makeBillingMock([]);
        mockBillingWith(billing);
        const ctx = makeContext();

        // Will fail downstream (service throws PLAN_NOT_FOUND / etc) since
        // we have no full mock — but NOT because of the H2 guard.
        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        // ALREADY_SUBSCRIBED must NOT be the error
        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    it('allows checkout when existing sub is cancelled (status=cancelled)', async () => {
        const billing = makeBillingMock([{ status: 'cancelled' }]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });
});

// ---------------------------------------------------------------------------
// Tests — SPEC-239 commerce isolation: H2 guard must NOT block on commerce subs
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — SPEC-239 commerce isolation in H2 guard', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does NOT block when customer has an active COMMERCE sub (product_domain=commerce)', async () => {
        // A customer with an active commerce subscription should be allowed to
        // start a paid ACCOMMODATION subscription. The H2 guard must only look at
        // accommodation-domain subs (isAccommodationSubscription filter).
        const billing = makeBillingMock([
            { status: 'active', productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        // Must NOT be blocked by H2 — ALREADY_SUBSCRIBED is wrong here
        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    it('does NOT block when customer has a trialing COMMERCE sub (product_domain=commerce)', async () => {
        const billing = makeBillingMock([
            { status: 'trialing', productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    it('DOES block when customer has an active ACCOMMODATION sub alongside a commerce sub', async () => {
        // Mixed: one commerce active sub + one accommodation active sub →
        // the accommodation one triggers ALREADY_SUBSCRIBED.
        const billing = makeBillingMock([
            { status: 'active', productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            },
            { status: 'active' } // no productDomain → treated as accommodation (fail-open)
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('does NOT block soft-cancel guard when only COMMERCE sub has cancelAtPeriodEnd=true', async () => {
        // A commerce sub with cancelAtPeriodEnd=true must not trigger the
        // SUBSCRIPTION_CANCEL_PENDING guard (SPEC-147 T-008 / Q7).
        const billing = makeBillingMock([
            { status: 'active', cancelAtPeriodEnd: true, productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('SUBSCRIPTION_CANCEL_PENDING');
        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });
});

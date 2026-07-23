/**
 * Unit tests for the `productDomain` query-param filter on
 * `GET /api/v1/protected/users/me/subscription` (HOS-259).
 *
 * A dual-role owner (accommodation host AND commerce-listing owner) can have
 * TWO subscriptions under the same billing customer. Before this filter, the
 * `.find()` picked whichever subscription came first regardless of domain,
 * which could surface the accommodation subscription when the caller
 * actually needed the commerce one (e.g. the commerce SUSPENDED recover CTA
 * — `CommerceListingActions.client.tsx`).
 *
 * Pattern: mock `createProtectedRoute` to capture the raw handler, then
 * invoke it directly (mirrors `host-favorites-breakdown.test.ts`). Avoids
 * booting the full Hono application and middleware chain.
 *
 * @module test/routes/user/subscription-product-domain
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs — available inside vi.mock() factory closures.
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown>
    >()
}));

const { mockGetByExternalId, mockGetByCustomerId, mockPlansGet, mockPlanServiceGetBySlug } =
    vi.hoisted(() => ({
        mockGetByExternalId: vi.fn(),
        mockGetByCustomerId: vi.fn(),
        mockPlansGet: vi.fn(),
        mockPlanServiceGetBySlug: vi.fn()
    }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Intercept createProtectedRoute to capture the raw handler without mounting Hono.
vi.mock('../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn(
        (config: {
            path: string;
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query?: unknown
            ) => Promise<unknown>;
        }) => {
            capturedHandlers.set(config.path, config.handler);
            return config.handler;
        }
    )
}));

vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn((ctx: { get: (k: string) => unknown }) => ctx.get('actor'))
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => ({
        customers: { getByExternalId: mockGetByExternalId },
        subscriptions: { getByCustomerId: mockGetByCustomerId },
        plans: { get: mockPlansGet }
    }))
}));

vi.mock('../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(function () {
        return { getBySlug: mockPlanServiceGetBySlug };
    })
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks) — triggers module execution, populating capturedHandlers.
// ---------------------------------------------------------------------------

await import('../../../src/routes/user/protected/subscription');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR = { id: 'user-1', role: 'HOST', permissions: [] };
const CUSTOMER = { id: 'customer-1' };

/** Builds a QZPay-shaped subscription row for a given domain + id. */
function buildSubscription(input: {
    id: string;
    status: string;
    planId: string;
    productDomain?: string;
}) {
    return {
        id: input.id,
        status: input.status,
        planId: input.planId,
        productDomain: input.productDomain,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null,
        scheduledPlanChange: null,
        isPastDue: () => false
    };
}

function buildContext(overrides: { billingEnabled?: boolean } = {}) {
    const store = new Map<string, unknown>([
        ['actor', ACTOR],
        ['billingEnabled', overrides.billingEnabled ?? true]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        set: vi.fn((k: string, v: unknown) => store.set(k, v))
    };
}

function getSubscriptionHandler() {
    const handler = capturedHandlers.get('/me/subscription');
    if (!handler) {
        throw new Error('No handler captured for path: /me/subscription');
    }
    return handler;
}

describe('GET /me/subscription — productDomain filter (HOS-259)', () => {
    beforeEach(() => {
        mockGetByExternalId.mockReset().mockResolvedValue(CUSTOMER);
        mockPlansGet.mockReset().mockResolvedValue({ name: 'owner-basico' });
        mockPlanServiceGetBySlug.mockReset().mockResolvedValue({
            success: true,
            data: { name: 'Plan Básico', monthlyPriceArs: 1000 }
        });
        mockGetByCustomerId.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('defaults to the accommodation subscription when productDomain is omitted', async () => {
        const accommodationSub = buildSubscription({
            id: 'sub-accommodation',
            status: 'active',
            planId: 'plan-accommodation',
            productDomain: 'accommodation'
        });
        const commerceSub = buildSubscription({
            id: 'sub-commerce',
            status: 'active',
            planId: 'plan-commerce',
            productDomain: 'commerce'
        });
        mockGetByCustomerId.mockResolvedValue([commerceSub, accommodationSub]);

        const handler = getSubscriptionHandler();
        const result = (await handler(buildContext(), {}, {}, {})) as {
            subscription: { id: string } | null;
        };

        expect(result.subscription?.id).toBe('sub-accommodation');
    });

    it('returns the accommodation subscription when productDomain=accommodation is explicit', async () => {
        const accommodationSub = buildSubscription({
            id: 'sub-accommodation',
            status: 'active',
            planId: 'plan-accommodation',
            productDomain: 'accommodation'
        });
        const commerceSub = buildSubscription({
            id: 'sub-commerce',
            status: 'past_due',
            planId: 'plan-commerce',
            productDomain: 'commerce'
        });
        mockGetByCustomerId.mockResolvedValue([commerceSub, accommodationSub]);

        const handler = getSubscriptionHandler();
        const result = (await handler(
            buildContext(),
            {},
            {},
            { productDomain: 'accommodation' }
        )) as {
            subscription: { id: string } | null;
        };

        expect(result.subscription?.id).toBe('sub-accommodation');
    });

    it('returns the commerce subscription when productDomain=commerce, even when it comes second', async () => {
        const accommodationSub = buildSubscription({
            id: 'sub-accommodation',
            status: 'active',
            planId: 'plan-accommodation',
            productDomain: 'accommodation'
        });
        const commerceSub = buildSubscription({
            id: 'sub-commerce',
            status: 'past_due',
            planId: 'plan-commerce',
            productDomain: 'commerce'
        });
        mockGetByCustomerId.mockResolvedValue([accommodationSub, commerceSub]);

        const handler = getSubscriptionHandler();
        const result = (await handler(buildContext(), {}, {}, { productDomain: 'commerce' })) as {
            subscription: { id: string } | null;
        };

        expect(result.subscription?.id).toBe('sub-commerce');
    });

    it('returns null when productDomain=commerce but the customer has no commerce subscription', async () => {
        const accommodationSub = buildSubscription({
            id: 'sub-accommodation',
            status: 'active',
            planId: 'plan-accommodation',
            productDomain: 'accommodation'
        });
        mockGetByCustomerId.mockResolvedValue([accommodationSub]);

        const handler = getSubscriptionHandler();
        const result = (await handler(buildContext(), {}, {}, { productDomain: 'commerce' })) as {
            subscription: { id: string } | null;
        };

        expect(result.subscription).toBeNull();
    });

    it('treats a legacy row with no productDomain as accommodation, not commerce', async () => {
        const legacySub = buildSubscription({
            id: 'sub-legacy',
            status: 'active',
            planId: 'plan-legacy',
            productDomain: undefined
        });
        mockGetByCustomerId.mockResolvedValue([legacySub]);

        const handler = getSubscriptionHandler();

        const accommodationResult = (await handler(
            buildContext(),
            {},
            {},
            {
                productDomain: 'accommodation'
            }
        )) as { subscription: { id: string } | null };
        expect(accommodationResult.subscription?.id).toBe('sub-legacy');

        const commerceResult = (await handler(
            buildContext(),
            {},
            {},
            {
                productDomain: 'commerce'
            }
        )) as { subscription: { id: string } | null };
        expect(commerceResult.subscription).toBeNull();
    });
});

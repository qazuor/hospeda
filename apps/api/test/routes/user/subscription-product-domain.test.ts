/**
 * Unit tests for the `productDomain` query-param filter on
 * `GET /api/v1/protected/users/me/subscription` (HOS-259, HOS-934).
 *
 * A dual-role owner (accommodation host AND commerce-listing owner) can have
 * TWO subscriptions under the same billing customer. Before the HOS-259
 * filter, the `.find()` picked whichever subscription came first regardless
 * of domain, which could surface the accommodation subscription when the
 * caller actually needed the commerce one (e.g. the commerce SUSPENDED
 * recover CTA — `CommerceListingActions.client.tsx`).
 *
 * HOS-934: `billing.subscriptions.getByCustomerId()` NEVER populates
 * `productDomain` on the objects it returns — qzpay-core's mapper builds
 * them field-by-field from the fields `QZPaySubscription` itself declares,
 * and `productDomain` is a qzpay-drizzle column outside that interface (see
 * `hydrateSubscriptionProductDomains`'s doc in
 * `@repo/service-core`). `buildSubscription()` below therefore does NOT set
 * `productDomain` on the fixture — that field is recovered by a batched
 * `SELECT` the route runs via `hydrateSubscriptionProductDomains`, mocked
 * through `mockGetDb()`. A fixture that injects `productDomain` directly
 * would hide exactly the bug this file exists to catch.
 *
 * Pattern: mock `createProtectedRoute` to capture the raw handler, then
 * invoke it directly (mirrors `host-favorites-breakdown.test.ts`). Avoids
 * booting the full Hono application and middleware chain.
 *
 * @module test/routes/user/subscription-product-domain
 */

import { getDb } from '@repo/db';
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

const ACTOR = { id: 'user-1', roles: ['HOST'], permissions: [] };
const CUSTOMER = { id: 'customer-1' };

/**
 * Builds a QZPay-shaped subscription row for a given id, WITHOUT
 * `productDomain` — real `getByCustomerId()` objects never carry that key
 * (HOS-934). See the module doc for why injecting it here would be a lying
 * fixture.
 */
function buildSubscription(input: { id: string; status: string; planId: string }) {
    return {
        id: input.id,
        status: input.status,
        planId: input.planId,
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

/**
 * Configures the mocked `getDb()` (from `@repo/db`, globally mocked in
 * `test/setup.ts`) to answer BOTH queries the route runs against real rows:
 *
 * 1. `hydrateSubscriptionProductDomains`'s batched recovery `SELECT` — the
 *    query under test — resolved from `productDomains` (id → stored
 *    `product_domain`, exactly as the column holds it in the DB).
 * 2. The route's own courtesy-window `SELECT` (`courtesyStartsAt` /
 *    `courtesyEndsAt` / `courtesyCyclesGranted`), resolved to an empty
 *    result (no courtesy window) unless the test doesn't reach it.
 *
 * Distinguishes the two queries by inspecting the `.select()` projection:
 * only the hydration query names a `productDomain` column.
 */
function mockGetDb(productDomains: Record<string, string | null>) {
    vi.mocked(getDb).mockImplementation(() => {
        let isProductDomainQuery = false;
        const chain: any = {
            select: vi.fn((cols: Record<string, unknown>) => {
                isProductDomainQuery = 'productDomain' in cols && 'id' in cols;
                return chain;
            }),
            from: vi.fn(() => chain),
            where: vi.fn(() => {
                if (isProductDomainQuery) {
                    const rows = Object.entries(productDomains).map(([id, productDomain]) => ({
                        id,
                        productDomain
                    }));
                    return Promise.resolve(rows);
                }
                return chain;
            }),
            limit: vi.fn(() => Promise.resolve([]))
        };
        return chain;
    });
}

describe('GET /me/subscription — productDomain filter (HOS-259, HOS-934)', () => {
    beforeEach(() => {
        mockGetByExternalId.mockReset().mockResolvedValue(CUSTOMER);
        mockPlansGet.mockReset().mockResolvedValue({ name: 'owner-basico' });
        mockPlanServiceGetBySlug.mockReset().mockResolvedValue({
            success: true,
            data: { name: 'Plan Básico', monthlyPriceArs: 1000 }
        });
        mockGetByCustomerId.mockReset();
        mockGetDb({});
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('defaults to the accommodation subscription when productDomain is omitted', async () => {
        const accommodationSub = buildSubscription({
            id: 'sub-accommodation',
            status: 'active',
            planId: 'plan-accommodation'
        });
        const commerceSub = buildSubscription({
            id: 'sub-commerce',
            status: 'active',
            planId: 'plan-commerce'
        });
        mockGetByCustomerId.mockResolvedValue([commerceSub, accommodationSub]);
        mockGetDb({ 'sub-accommodation': 'accommodation', 'sub-commerce': 'commerce' });

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
            planId: 'plan-accommodation'
        });
        const commerceSub = buildSubscription({
            id: 'sub-commerce',
            status: 'past_due',
            planId: 'plan-commerce'
        });
        mockGetByCustomerId.mockResolvedValue([commerceSub, accommodationSub]);
        mockGetDb({ 'sub-accommodation': 'accommodation', 'sub-commerce': 'commerce' });

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
            planId: 'plan-accommodation'
        });
        const commerceSub = buildSubscription({
            id: 'sub-commerce',
            status: 'past_due',
            planId: 'plan-commerce'
        });
        mockGetByCustomerId.mockResolvedValue([accommodationSub, commerceSub]);
        mockGetDb({ 'sub-accommodation': 'accommodation', 'sub-commerce': 'commerce' });

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
            planId: 'plan-accommodation'
        });
        mockGetByCustomerId.mockResolvedValue([accommodationSub]);
        mockGetDb({ 'sub-accommodation': 'accommodation' });

        const handler = getSubscriptionHandler();
        const result = (await handler(buildContext(), {}, {}, { productDomain: 'commerce' })) as {
            subscription: { id: string } | null;
        };

        expect(result.subscription).toBeNull();
    });

    it('treats a legacy row with a NULL stored productDomain as accommodation, not commerce', async () => {
        const legacySub = buildSubscription({
            id: 'sub-legacy',
            status: 'active',
            planId: 'plan-legacy'
        });
        mockGetByCustomerId.mockResolvedValue([legacySub]);
        mockGetDb({ 'sub-legacy': null });

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

    // -----------------------------------------------------------------------
    // HOS-934 acceptance criteria — the hydration itself, not just the filter.
    //
    // These tests are the ones that actually catch a broken/missing
    // hydration: the subscription fixture never carries `productDomain`, so
    // if the route stopped calling `hydrateSubscriptionProductDomains` (or
    // called it and threw its result away), `subscriptionMatchesDomain`
    // would see `productDomain: undefined` on every row and fail OPEN to
    // accommodation for all of them — exactly the production bug.
    // -----------------------------------------------------------------------

    it('HOS-934 AC-1: a gastronomy-only account resolves under gastronomy, and null under the other two verticals', async () => {
        const gastronomySub = buildSubscription({
            id: 'sub-gastronomy',
            status: 'active',
            planId: 'plan-gastronomy'
        });
        mockGetByCustomerId.mockResolvedValue([gastronomySub]);
        mockGetDb({ 'sub-gastronomy': 'gastronomy' });

        const handler = getSubscriptionHandler();

        const gastronomyResult = (await handler(
            buildContext(),
            {},
            {},
            {
                productDomain: 'gastronomy'
            }
        )) as { subscription: { id: string } | null };
        expect(gastronomyResult.subscription?.id).toBe('sub-gastronomy');

        const accommodationResult = (await handler(
            buildContext(),
            {},
            {},
            {
                productDomain: 'accommodation'
            }
        )) as { subscription: { id: string } | null };
        expect(accommodationResult.subscription).toBeNull();

        const experienceResult = (await handler(
            buildContext(),
            {},
            {},
            {
                productDomain: 'experience'
            }
        )) as { subscription: { id: string } | null };
        expect(experienceResult.subscription).toBeNull();
    });

    it('HOS-934 AC-2 (control): an accommodation-only account still resolves under accommodation — the fix must not invert the bug', async () => {
        const accommodationSub = buildSubscription({
            id: 'sub-accommodation-only',
            status: 'active',
            planId: 'plan-accommodation'
        });
        mockGetByCustomerId.mockResolvedValue([accommodationSub]);
        mockGetDb({ 'sub-accommodation-only': 'accommodation' });

        const handler = getSubscriptionHandler();
        const result = (await handler(
            buildContext(),
            {},
            {},
            {
                productDomain: 'accommodation'
            }
        )) as { subscription: { id: string } | null };

        expect(result.subscription?.id).toBe('sub-accommodation-only');
    });
});

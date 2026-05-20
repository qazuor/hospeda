/**
 * Free-plan signup + entitlements (SPEC-143 T-143-58).
 *
 * Validates the production behavior added in the same PR: an authenticated
 * user that has a billing_customer record but no active paid subscription
 * receives the tourist-free entitlements + limits by default. Previously
 * `loadEntitlements` returned an empty `Set` / empty `Map` for this case
 * even though `TOURIST_FREE_PLAN` exists in `packages/billing/src/config/plans.config.ts`
 * with `isDefault: true` — the flag was dead metadata. SPEC-143 T-143-58
 * wired it up via the new `getDefaultEntitlements()` helper in `@repo/billing`
 * and the `buildDefaultEntitlementsResult()` fallback in the entitlement
 * middleware.
 *
 * Test surface:
 *   - new billing customer (no subscriptions) → tourist-free entitlements
 *   - cache populated + reused on second probe
 *   - upgrading to a paid subscription switches entitlements off the
 *     fallback and onto the plan
 *
 * Out of scope for this file:
 *   - cancelled-only subscriptions fallback — covered by
 *     entitlement-load.test.ts:297 ("falls back to tourist-free entitlements
 *     when the customer has only cancelled subscriptions").
 *   - the actual checkout HTTP flow — covered by annual-checkout.test.ts /
 *     monthly-checkout.test.ts. We test the entitlement transition after a
 *     subscription becomes active, not the activation pipeline itself.
 *   - guests / unauthenticated requests — the middleware short-circuits
 *     before `loadEntitlements` for those (billing-customer middleware sets
 *     billingCustomerId to null), so the fallback never runs. Empty
 *     entitlements for guests is the documented behavior; tourist-free is
 *     authenticated-only.
 *
 * @module test/e2e/flows/billing/free-plan-signup
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock so the billing instance constructs without reaching
// for live MP credentials. None of these tests exercise checkout — the
// stub just satisfies the lazy adapter init.
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — free-plan-signup.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware,
    getEntitlementCacheStats
} from '../../../../src/middlewares/entitlement.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Shape of the probe response. Same as entitlement-load.test.ts so any
 * downstream tooling that scrapes probes sees a consistent surface.
 */
interface ProbeResponse {
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
    readonly billingLoadFailed: boolean;
}

/**
 * Mini-app that runs the REAL entitlement middleware for the given
 * billing customer id. Mirrors the pattern in entitlement-load.test.ts:
 * synthetic prelude sets the per-request context vars, then the real
 * middleware decides what to emit.
 */
function buildProbeApp(customerId: string): Hono {
    const app = new Hono();
    app.use((c, next) => {
        c.set('billingEnabled', true);
        c.set('billingCustomerId', customerId);
        return next();
    });
    app.use(entitlementMiddleware());
    app.get('/probe', (c) => {
        const entitlements = Array.from(c.get('userEntitlements') ?? []);
        const limits = Object.fromEntries(c.get('userLimits') ?? new Map());
        const billingLoadFailed = c.get('billingLoadFailed') ?? false;
        return c.json({ entitlements, limits, billingLoadFailed } satisfies ProbeResponse);
    });
    return app;
}

async function probe(app: Hono): Promise<ProbeResponse> {
    const res = await app.request('/probe');
    expect(res.status).toBe(200);
    return (await res.json()) as ProbeResponse;
}

describe('SPEC-143 T-143-58 — free-plan signup fallback', () => {
    let cheapPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        // initApp() boots the real Hono app + global middleware stack so
        // the billing singleton initializes against the mocked
        // @repo/billing module. The returned app is unused — these tests
        // run the entitlement middleware directly through buildProbeApp.
        initApp();
        // Force re-init through the mocked createMercadoPagoAdapter
        // factory in case another suite already cached the real adapter.
        resetBillingInstance();
        // Initialize the seeded plans once for the whole suite. The
        // upgrade-flow test reuses the cheap plan resolved here.
        const seeded = await seedBillingTestPlans();
        cheapPlanId = seeded.cheap.planId;
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(() => {
        mpStub.config.reset();
    });

    it('grants tourist-free entitlements + limits to a customer with zero subscriptions', async () => {
        // ARRANGE: a brand-new authenticated user + billing customer with
        // NO subscriptions of any status. This is the post-signup state
        // before any checkout flow runs: BillingCustomerSyncService
        // creates the customer record but no subscription row exists.
        const user = await createTestUser();
        const { customerId } = await createTestBillingCustomer({
            externalId: user.id
        });

        // ACT
        const body = await probe(buildProbeApp(customerId));

        // ASSERT: tourist-free entitlements (4 keys) + limit
        // (max_favorites=3) per TOURIST_FREE_PLAN at
        // packages/billing/src/config/plans.config.ts:247-267. Keep the
        // assertion shape in sync with that plan if it moves.
        expect(new Set(body.entitlements)).toEqual(
            new Set(['save_favorites', 'write_reviews', 'read_reviews', 'can_view_recommendations'])
        );
        expect(body.limits).toEqual({ max_favorites: 3 });
        expect(body.billingLoadFailed).toBe(false);
    });

    it('caches the fallback result and serves it on the second probe', async () => {
        // ARRANGE: same customer shape as the previous test.
        const user = await createTestUser();
        const { customerId } = await createTestBillingCustomer({
            externalId: user.id
        });

        const app = buildProbeApp(customerId);

        try {
            // ACT: first probe populates the cache via the fallback path
            // (shouldCache=true because the result is purely from static
            // config — see buildDefaultEntitlementsResult JSDoc).
            const first = await probe(app);
            expect(first.entitlements).toHaveLength(4);

            const statsAfterFirst = getEntitlementCacheStats();
            expect(statsAfterFirst.size).toBeGreaterThanOrEqual(1);

            // ACT: second probe must serve from cache. We cannot directly
            // assert "billing was not called again" without intrusive
            // monkey-patching of the qzpay-billing singleton, so we assert
            // the cache reuse via response shape parity + size stability.
            const second = await probe(app);
            expect(second.entitlements).toEqual(first.entitlements);
            expect(second.limits).toEqual(first.limits);

            const statsAfterSecond = getEntitlementCacheStats();
            expect(statsAfterSecond.size).toBe(statsAfterFirst.size);
        } finally {
            // The cache singleton outlives this test; evict the entry
            // explicitly so later tests do not inherit the cached fallback.
            clearEntitlementCache(customerId);
        }
    });

    it('switches off the free-tier fallback when the customer activates a paid subscription', async () => {
        // ARRANGE: customer first lives on the free-tier fallback, then
        // an active subscription on the seeded "cheap" test plan is
        // inserted. The middleware cache is cleared between the two
        // probes to simulate the cache invalidation that the activation
        // webhook performs (subscription-activation.test.ts T-143-18
        // exercises that webhook path; here we test the entitlement
        // transition in isolation).
        const user = await createTestUser();
        const { customerId } = await createTestBillingCustomer({
            externalId: user.id
        });

        const app = buildProbeApp(customerId);

        try {
            // ACT 1: free-tier fallback
            const beforeUpgrade = await probe(app);
            expect(beforeUpgrade.entitlements).toContain('save_favorites');
            expect(beforeUpgrade.limits.max_favorites).toBe(3);

            // ACT 2: insert active subscription + invalidate the cached
            // fallback for this customer (the activation webhook does
            // this in production). The function requires a customerId
            // arg — calling it bare is a silent no-op that would leave
            // the stale fallback cached.
            await createTestSubscription({
                customerId,
                planId: cheapPlanId,
                status: 'active'
            });
            clearEntitlementCache(customerId);

            // ACT 3: subsequent probe loads the cheap plan's entitlements
            // (public:read + ads_per_month=5 per seed-helpers.ts:300-303)
            // and NO longer falls back to tourist-free.
            const afterUpgrade = await probe(app);
            expect(afterUpgrade.entitlements).toEqual(['public:read']);
            expect(afterUpgrade.limits).toEqual({ ads_per_month: 5 });
            expect(afterUpgrade.billingLoadFailed).toBe(false);

            // The free-tier entitlements MUST be absent now — that is the
            // key regression guard. If a future change to the loader
            // accidentally unions the fallback with the active plan's
            // entitlements, this assertion fails loudly.
            expect(afterUpgrade.entitlements).not.toContain('save_favorites');
            expect(afterUpgrade.limits.max_favorites).toBeUndefined();
        } finally {
            clearEntitlementCache(customerId);
        }
    });
});

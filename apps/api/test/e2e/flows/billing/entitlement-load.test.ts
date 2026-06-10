/**
 * Entitlement load pipeline post-activation (SPEC-143 T-143-19).
 *
 * Closes the structural e2e gap left by SPEC-141 (Subscription post-launch
 * follow-ups). SPEC-141 added unit-level coverage for the entitlement load
 * pipeline using mocks; this file validates the same pipeline end-to-end
 * against a real Postgres + the real qzpay-billing instance.
 *
 * Sub-commits 4 of the per-flow files (annual-checkout, monthly-checkout,
 * plan-upgrade, plan-downgrade-cron, addon-purchase) already probe the
 * load pipeline after their respective activation legs, but each focuses
 * on the cache-invalidation side of a SINGLE flow. They share two
 * properties:
 *   - plan-level entitlements + limits only (no customer overrides)
 *   - cache-miss path (cache is cleared by the activation webhook)
 *
 * This file probes the OTHER paths of `loadEntitlements`
 * (apps/api/src/middlewares/entitlement.ts:146): customer-level
 * entitlement merge, customer-level limit override, cache-hit reuse,
 * cancelled-only subscriptions, multi-subscription active selection,
 * and the plan-not-found warn branch. None of these depend on the
 * webhook activation path; tests insert an already-active subscription
 * via the factory and assert what the probe surfaces.
 *
 * Probe pattern mirrors the sub-commit 4 mini-app: a Hono app that
 * mounts the REAL `entitlementMiddleware` against the REAL billing
 * instance, with a synthetic prelude that sets `billingEnabled` +
 * `billingCustomerId`. The probe surfaces `userEntitlements` +
 * `userLimits` as JSON for assertion.
 *
 * SCOPE NOTE: the degraded-fallback branch (entitlement.ts:223-240,
 * `shouldCache: false` when customer-level fetch throws) is covered by
 * SPEC-141 unit tests with mocks. Reproducing it e2e requires intrusive
 * monkey-patching of the qzpay-billing singleton's getter-built service
 * object, which has low e2e value relative to its complexity cost. The
 * unit coverage stands.
 *
 * @module test/e2e/flows/billing/entitlement-load
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter. The billing instance
// initializes a MercadoPago adapter at construction time even though
// none of these tests exercise a checkout/webhook path — without the
// stub the adapter constructor reaches for live MP credentials and
// throws during billing init.
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
                    'mp-stub adapter not initialized — entitlement-load.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import {
    billingCustomerEntitlements,
    billingCustomerLimits,
    billingSubscriptions,
    eq,
    getDb
} from '@repo/db';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
 * Shape of the probe response. Surfaces the entitlement middleware's
 * decision for the customer in context — the same data downstream
 * routes consume via `c.get('userEntitlements')` / `c.get('userLimits')`.
 */
interface ProbeResponse {
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
    readonly billingLoadFailed: boolean;
}

/**
 * Build a fresh Hono mini-app that runs the REAL entitlement middleware
 * against the REAL billing instance for the given customer id and exposes
 * the resulting userEntitlements + userLimits on GET /probe.
 *
 * A new app per call ensures no middleware order or state leaks between
 * tests; the cache singleton is the only cross-app state and is reset
 * explicitly via `clearEntitlementCache` in `afterEach`.
 */
function buildProbeApp(customerId: string): Hono {
    const app = new Hono();
    app.use((c, next) => {
        c.set('billingEnabled', true);
        c.set('billingCustomerId', customerId);
        return next();
    });
    app.use(entitlementMiddleware());
    app.get('/probe', (c) =>
        c.json({
            entitlements: Array.from(c.get('userEntitlements') ?? []),
            limits: Object.fromEntries(c.get('userLimits') ?? new Map()),
            billingLoadFailed: c.get('billingLoadFailed') ?? false
        } satisfies ProbeResponse)
    );
    return app;
}

/**
 * Convenience wrapper: probe and return parsed body.
 */
async function probe(app: Hono): Promise<ProbeResponse> {
    const res = await app.request('/probe');
    expect(res.status).toBe(200);
    return (await res.json()) as ProbeResponse;
}

describe('SPEC-143 T-143-19 — entitlement load pipeline post-activation', () => {
    let cheapPlanId: string;
    let expensivePlanId: string;
    let customerId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        // initApp() boots the real Hono app + global middleware stack.
        // Required so that the billing singleton initializes against the
        // mocked @repo/billing module. Result is otherwise unused — these
        // tests never `.request` against the main app.
        initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;
        expensivePlanId = seed.expensive.planId;

        const user = await createTestUser({
            email: `entitlement-load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;
    });

    afterEach(async () => {
        // Cache singleton lives outside the DB and outside testDb.clean(),
        // so each test must evict its own entry to keep cross-test
        // independence. Other tests may have populated entries for
        // unrelated customers; we only clear the one we wrote.
        clearEntitlementCache(customerId);
        await testDb.clean();
    });

    it('merges customer-level entitlement grants with plan entitlements', async () => {
        // ARRANGE: active subscription on the cheap plan. Cheap plan
        // declares entitlements ['public:read'] in seed-helpers.ts.
        await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active'
        });

        // ARRANGE: customer-level grant for an entitlement that is NOT in
        // the plan. The loader fetches it via
        // billing.entitlements.getByCustomerId() and union's it onto the
        // plan-level set (entitlement.ts:213-216).
        await getDb()
            .insert(billingCustomerEntitlements)
            .values({
                customerId,
                entitlementKey: 'premium:write',
                source: 'manual',
                livemode: false
            } as typeof billingCustomerEntitlements.$inferInsert);

        // ACT
        const body = await probe(buildProbeApp(customerId));

        // ASSERT: union of plan + customer-level entitlements.
        expect(new Set(body.entitlements)).toEqual(new Set(['public:read', 'premium:write']));
        expect(body.limits.ads_per_month).toBe(5);
        expect(body.billingLoadFailed).toBe(false);
    });

    it('lets customer-level limits override the plan limit value', async () => {
        // ARRANGE: active sub on cheap plan (ads_per_month: 5).
        await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active'
        });

        // ARRANGE: customer-level override that BUMPS the limit to 20.
        // Per entitlement.ts:219-222, customer values overwrite plan
        // values via `limits.set(key, customerValue)` after the plan
        // values were seeded; precedence is customer > plan.
        await getDb()
            .insert(billingCustomerLimits)
            .values({
                customerId,
                limitKey: 'ads_per_month',
                maxValue: 20,
                source: 'manual',
                livemode: false
            } as typeof billingCustomerLimits.$inferInsert);

        // ACT
        const body = await probe(buildProbeApp(customerId));

        // ASSERT: customer override wins.
        expect(body.limits.ads_per_month).toBe(20);
        // Plan entitlements remain intact (no customer entitlements were
        // granted, so the set is plan-only).
        expect(body.entitlements).toEqual(['public:read']);
        expect(body.billingLoadFailed).toBe(false);
    });

    it('serves a cached entry on the second probe without re-querying billing storage', async () => {
        // ARRANGE: active sub. Probe once to prime the cache with the
        // plan-only entitlement set.
        await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active'
        });
        const probeApp = buildProbeApp(customerId);

        const firstBody = await probe(probeApp);
        expect(firstBody.entitlements).toEqual(['public:read']);

        // ACT: grant a customer-level entitlement AFTER caching. Because
        // `entitlementMiddleware` checks the cache first
        // (entitlement.ts:310-314), the next request should NOT re-read
        // billing storage and should NOT see the newly-granted entry.
        await getDb()
            .insert(billingCustomerEntitlements)
            .values({
                customerId,
                entitlementKey: 'cache:stale-marker',
                source: 'manual',
                livemode: false
            } as typeof billingCustomerEntitlements.$inferInsert);

        const cachedBody = await probe(probeApp);

        // ASSERT: stale read proves the cache served the second probe.
        expect(cachedBody.entitlements).toEqual(['public:read']);
        expect(cachedBody.entitlements).not.toContain('cache:stale-marker');

        // ACT 2: explicit cache eviction (mirrors what
        // `clearEntitlementCache` does in webhook handlers post-mutation).
        // The next probe re-loads from storage and sees the new grant.
        clearEntitlementCache(customerId);
        const freshBody = await probe(probeApp);

        // ASSERT: post-eviction read picks up the newly-granted
        // entitlement, confirming the prior staleness was a cache hit
        // and not a storage write race.
        expect(new Set(freshBody.entitlements)).toEqual(
            new Set(['public:read', 'cache:stale-marker'])
        );
    });

    it('falls back to tourist-free entitlements when the customer has only cancelled subscriptions', async () => {
        // ARRANGE: a single subscription in `cancelled` status. The
        // middleware's active-sub filter (entitlement.ts:167-169) accepts
        // only `active` or `trialing`, so the `find()` returns undefined
        // and the loader takes the "no active subscription" branch.
        //
        // Per SPEC-143 T-143-58 that branch now falls back to the default
        // tourist-free entitlements instead of returning an empty set —
        // every authenticated user is entitled to the free baseline.
        //
        // Distinct from the sub-commits 4 pre-webhook probes: those
        // exercised `pending_provider` (subscription exists but is not
        // yet active). This test exercises `cancelled` — the post-active
        // lifecycle terminal state.
        await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'cancelled'
        });

        // ACT
        const body = await probe(buildProbeApp(customerId));

        // ASSERT: tourist-free entitlements + limits + billing did not
        // fail. Expected set matches TOURIST_FREE_PLAN at
        // packages/billing/src/config/plans.config.ts:247-267 — keep the
        // assertion shape in sync if that plan's definition moves.
        expect(new Set(body.entitlements)).toEqual(
            new Set(['save_favorites', 'write_reviews', 'read_reviews', 'can_view_recommendations'])
        );
        expect(body.limits).toEqual({ max_favorites: 3 });
        expect(body.billingLoadFailed).toBe(false);

        // Cache MUST be populated for this customer with the free-tier
        // set. shouldCache=true on the fallback branch because the
        // result derives from static config — nothing customer-level to
        // invalidate.
        const stats = getEntitlementCacheStats();
        expect(stats.size).toBeGreaterThanOrEqual(1);
    });

    it('picks the active subscription when the customer also has a cancelled one', async () => {
        // ARRANGE: a customer with TWO subscriptions — one cancelled on
        // the cheap plan, one active on the expensive plan. The loader's
        // `.find()` (entitlement.ts:167-169) walks the list and returns
        // the first match with status active or trialing.
        await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'cancelled'
        });
        await createTestSubscription({
            customerId,
            planId: expensivePlanId,
            status: 'active'
        });

        // ACT
        const body = await probe(buildProbeApp(customerId));

        // ASSERT: the EXPENSIVE plan's entitlements + limits surface,
        // not the cancelled cheap plan's. Expensive plan declares
        // ['public:read', 'expensive:feature'] + { ads_per_month: 100 }
        // in seed-helpers.ts:352-353.
        expect(new Set(body.entitlements)).toEqual(new Set(['public:read', 'expensive:feature']));
        expect(body.limits.ads_per_month).toBe(100);
        expect(body.billingLoadFailed).toBe(false);
    });

    it('returns empty entitlements when the active subscription points to a plan that does not exist', async () => {
        // ARRANGE: insert an active subscription with a planId that
        // references no row in `billing_plans`. The DB allows this
        // because `billing_subscriptions.plan_id` is varchar with no FK
        // to `billing_plans.id` (gotcha documented in
        // billing-factories.ts:181-183). The loader's `billing.plans.get`
        // call (entitlement.ts:181) returns null, the warn branch fires
        // (entitlement.ts:184-191), and the result is an empty set with
        // shouldCache=true.
        const orphanPlanId = randomUUID();
        await createTestSubscription({
            customerId,
            planId: orphanPlanId,
            status: 'active'
        });

        // Sanity: the orphan plan really has no row.
        const subs = await getDb()
            .select({ planId: billingSubscriptions.planId })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, customerId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.planId).toBe(orphanPlanId);

        // ACT
        const body = await probe(buildProbeApp(customerId));

        // ASSERT: empty entitlements + empty limits, billing did not
        // fail (the plan-not-found warn path is a "healthy but
        // degraded" state from the middleware's perspective — no 503).
        expect(body.entitlements).toEqual([]);
        expect(body.limits).toEqual({});
        expect(body.billingLoadFailed).toBe(false);
    });
});

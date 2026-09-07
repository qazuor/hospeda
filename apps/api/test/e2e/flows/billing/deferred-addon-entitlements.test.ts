/**
 * A DEFERRED add-on keeps paying out after the plan that carried it is gone
 * (HOS-847 PR 7b), end to end.
 *
 * ## Why this is not a unit test
 *
 * PR 7a's deferral was covered by unit tests with mocks, and every one of them
 * passed while the feature delivered NOTHING: they asserted that the purchase
 * row was left `active` with `cancel_at_period_end = true`, which was true, and
 * never asked what a request then saw. Both entitlement resolvers return before
 * they merge customer-level grants when there is no live subscription, so the
 * customer got the fallback plan and not one thing more.
 *
 * So these run the REAL `entitlementMiddleware` against the REAL billing
 * instance and a real Postgres row, and assert on the LIMIT the request ends up
 * with. A mock cannot make that mistake invisible again.
 *
 * ## Why its own file
 *
 * `entitlement-load.test.ts` is the natural home and is currently red on this
 * branch for unrelated reasons — its expectations still name the placeholder
 * plan grants (`public:read`, `ads_per_month`) that `seed-helpers.ts` stopped
 * seeding when HOS-296 switched the baseline plans to real
 * `EntitlementKey`/`LimitKey` values. Repairing that drift is not HOS-847's
 * change to make, and adding a new test to a red file buries its result.
 *
 * @module test/e2e/flows/billing/deferred-addon-entitlements
 */

import { vi } from 'vitest';

// Same hoisted MercadoPago adapter stub as the sibling billing e2e files: the
// billing singleton builds an adapter at construction time even though nothing
// here touches a checkout, and the real constructor reaches for live MP
// credentials.
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
                    'mp-stub adapter not initialized — deferred-addon-entitlements.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingAddonPurchases, getDb } from '@repo/db';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware
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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The tourist-free baseline every non-HOST actor without a live subscription
 * falls back to (`TOURIST_FREE_PLAN` in `packages/billing/src/config/plans.config.ts`).
 * Named here so the deltas below read as deltas.
 */
const FREE_MAX_FAVORITES = 5;

/** What the deferred add-on's `limit_adjustments` row buys. */
const ADDON_FAVORITES_INCREASE = 10;

/** Shape of the probe response. */
interface ProbeResponse {
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
}

/**
 * A Hono mini-app running the REAL entitlement middleware for one customer.
 *
 * @param customerId - QZPay customer the middleware should resolve.
 * @returns An app exposing the resolved entitlements + limits on GET /probe.
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
            limits: Object.fromEntries(c.get('userLimits') ?? new Map())
        } satisfies ProbeResponse)
    );
    return app;
}

/**
 * Probes the middleware once and returns the parsed body.
 *
 * @param customerId - QZPay customer to resolve.
 * @returns The resolved entitlements + limits.
 */
async function probe(customerId: string): Promise<ProbeResponse> {
    const res = await buildProbeApp(customerId).request('/probe');
    expect(res.status).toBe(200);
    return (await res.json()) as ProbeResponse;
}

/** Options for {@link insertAddonPurchase}. */
interface InsertAddonPurchaseInput {
    readonly customerId: string;
    readonly subscriptionId: string;
    /** The PR 7a deferral flag. */
    readonly cancelAtPeriodEnd: boolean;
    /** The add-on's OWN period end — the plan's says nothing about it. */
    readonly currentPeriodEnd: Date | null;
    readonly status?: string;
}

/**
 * Inserts one `billing_addon_purchases` row carrying both adjustment arrays,
 * exactly as the recurring activation path writes them
 * (`computeAddonPurchaseAdjustments`).
 *
 * @param input - Customer, subscription, and the two fields the deferral turns on.
 */
async function insertAddonPurchase(input: InsertAddonPurchaseInput): Promise<void> {
    await getDb()
        .insert(billingAddonPurchases)
        .values({
            customerId: input.customerId,
            subscriptionId: input.subscriptionId,
            addonSlug: 'extra-favorites-10',
            status: input.status ?? 'active',
            cancelAtPeriodEnd: input.cancelAtPeriodEnd,
            currentPeriodEnd: input.currentPeriodEnd,
            limitAdjustments: [
                {
                    limitKey: 'max_favorites',
                    increase: ADDON_FAVORITES_INCREASE,
                    previousValue: FREE_MAX_FAVORITES,
                    newValue: FREE_MAX_FAVORITES + ADDON_FAVORITES_INCREASE
                }
            ],
            entitlementAdjustments: [{ entitlementKey: 'featured_listing', granted: true }]
        } as typeof billingAddonPurchases.$inferInsert);
}

describe('HOS-847 PR 7b — a deferred add-on outlives the plan on the request path', () => {
    let cheapPlanId: string;
    let customerId: string;
    let subscriptionId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        // Boots the real middleware stack so the billing singleton initialises
        // against the mocked @repo/billing module. The app itself is unused —
        // these tests request the mini-app above.
        initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;

        const user = await createTestUser({
            email: `deferred-addon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        // The plan is CANCELLED — this is the state the whole feature is about.
        // `loadEntitlements` finds no entitlement-granting subscription and takes
        // the fallback branch.
        const subscription = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'cancelled'
        });
        subscriptionId = subscription.subscriptionId;
    });

    afterEach(async () => {
        // The entitlement cache is a module singleton outside testDb.clean().
        clearEntitlementCache(customerId);
        await testDb.clean();
    });

    it('CONTROL: with no add-on at all, the cancelled plan leaves the tourist-free baseline', async () => {
        const body = await probe(customerId);

        expect(body.limits.max_favorites).toBe(FREE_MAX_FAVORITES);
        expect(body.entitlements).not.toContain('featured_listing');
    });

    it('raises the limit and grants the entitlement while the paid period is still running', async () => {
        // ARRANGE: the add-on the cancellation flow deferred — still `active`,
        // flagged `cancel_at_period_end`, fifteen days of paid period left.
        await insertAddonPurchase({
            customerId,
            subscriptionId,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: new Date(Date.now() + 15 * DAY_MS)
        });

        // ACT
        const body = await probe(customerId);

        // ASSERT: the increase lands ON TOP of the fallback baseline, and the
        // add-on's entitlement is granted. This is the assertion PR 7a lacked —
        // every mock-level test it shipped passed while this number stayed 5.
        expect(body.limits.max_favorites).toBe(FREE_MAX_FAVORITES + ADDON_FAVORITES_INCREASE);
        expect(body.entitlements).toContain('featured_listing');

        // The baseline is not replaced, only added to.
        expect(new Set(body.entitlements)).toEqual(
            new Set(['save_favorites', 'write_reviews', 'read_reviews', 'featured_listing'])
        );
    });

    it('CONTROL: an elapsed paid period grants nothing', async () => {
        // Yesterday. The `addon-expiry` cron owns this row now; it must not keep
        // granting on the strength of the flag alone.
        await insertAddonPurchase({
            customerId,
            subscriptionId,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: new Date(Date.now() - DAY_MS)
        });

        const body = await probe(customerId);

        expect(body.limits.max_favorites).toBe(FREE_MAX_FAVORITES);
        expect(body.entitlements).not.toContain('featured_listing');
    });

    it('CONTROL: an add-on nobody deferred grants nothing on this branch', async () => {
        // `cancel_at_period_end = false` with a live period is a HEALTHY add-on
        // under a plan that just died — no cause-aware caller has decided about
        // it yet. Counting it here would both pre-empt that decision and
        // double-count once the normal customer-level merge runs.
        await insertAddonPurchase({
            customerId,
            subscriptionId,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: new Date(Date.now() + 15 * DAY_MS)
        });

        const body = await probe(customerId);

        expect(body.limits.max_favorites).toBe(FREE_MAX_FAVORITES);
        expect(body.entitlements).not.toContain('featured_listing');
    });

    it('CONTROL: a revoked row grants nothing even inside its period', async () => {
        await insertAddonPurchase({
            customerId,
            subscriptionId,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: new Date(Date.now() + 15 * DAY_MS),
            status: 'canceled'
        });

        const body = await probe(customerId);

        expect(body.limits.max_favorites).toBe(FREE_MAX_FAVORITES);
        expect(body.entitlements).not.toContain('featured_listing');
    });
});

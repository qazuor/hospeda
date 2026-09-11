/**
 * HOS-847 PR 7b — the JUNCTION between `loadEntitlements` and the deferred
 * add-on grants, exercised through the real middleware.
 *
 * ## Why this file exists next to `test/services/deferred-addon-grants.test.ts`
 *
 * That suite covers `loadDeferredAddonGrants` and `mergeDeferredAddonGrants`
 * SEPARATELY, and both are correct in isolation. What it cannot observe is
 * whether the resolver ever calls them: delete the two lines from
 * `loadEntitlements`'s fallback branches and all nine of its cases stay green
 * while the customer silently stops receiving what they paid for. That is not a
 * hypothetical failure mode — it is exactly how PR 7a shipped: the row said
 * `active`, the QZPay grant was intact, and nothing on the request path ever
 * looked at either.
 *
 * The end-to-end proof lives in
 * `test/e2e/flows/billing/deferred-addon-entitlements.test.ts`, which no CI job
 * runs (HOS-715: `vitest.config.ts` excludes `test/e2e/**`, the integration
 * config only includes `test/integration/ai/**`, and the nightly e2e workflow
 * only points at `test/integration/security`). So the seam is asserted HERE, in
 * the runner CI actually executes.
 *
 * ## What is mocked, and what deliberately is not
 *
 * Mocked: the QZPay client (`getQZPayBilling`), the `owner-basico` plan lookup,
 * and `getDb` — routed by TABLE IDENTITY so the deferred-purchase read and the
 * `hydrateSubscriptionProductDomains` read get their own answers.
 *
 * NOT mocked: `loadDeferredAddonGrants`, `mergeDeferredAddonGrants`, and the
 * `parseLimitAdjustments`/`parseEntitlementAdjustments` they call. Stubbing any
 * of those would restore the blindness this file is here to remove.
 *
 * @module test/middlewares/entitlement-deferred-addon-grants
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { billingAddonPurchases, billingSubscriptions, getDb } from '@repo/db';
import { PlanService, RoleEnum } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    clearEntitlementCache,
    clearHostDraftDefaultsCache,
    entitlementMiddleware
} from '../../src/middlewares/entitlement';
import type { AppBindings } from '../../src/types';

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

/**
 * The fallback plan a HOST with no live subscription lands on. Its
 * `max_accommodations: 1` is the BASELINE every assertion below is measured
 * against — a deferred add-on has to raise it, and its absence has to leave it
 * exactly where it is.
 */
const OWNER_BASICO = {
    id: 'plan-owner-basico',
    slug: 'owner-basico',
    name: 'Basic',
    entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS] as string[],
    limits: {
        [LimitKey.MAX_ACCOMMODATIONS]: 1,
        [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 15
    }
};

/**
 * One `billing_addon_purchases` row as the deferred read selects it: an add-on
 * whose owner cancelled it (`cancel_at_period_end = true`) but whose paid period
 * has not run out yet.
 *
 * The four WHERE predicates are not re-asserted here — that is
 * `test/services/deferred-addon-grants.test.ts`'s job. What matters at this seam
 * is that the row's adjustments reach the request at all.
 */
const DEFERRED_PURCHASE_ROW = {
    id: 'purchase-extra-accommodations',
    addonSlug: 'extra-accommodations-5',
    limitAdjustments: [
        {
            limitKey: LimitKey.MAX_ACCOMMODATIONS,
            increase: 4,
            previousValue: 1,
            newValue: 5
        }
    ],
    entitlementAdjustments: [{ entitlementKey: EntitlementKey.FEATURED_LISTING, granted: true }]
};

/** Rows the routed `getDb` stub answers with, keyed by the table object. */
type TableRows = ReadonlyMap<unknown, readonly unknown[]>;

/**
 * Installs a `getDb` whose `select().from(table).where()` resolves per TABLE.
 *
 * Routing by table identity rather than by call order is what keeps the
 * `hydrateSubscriptionProductDomains` read (which runs whenever the customer has
 * any subscription at all) from consuming the answer meant for the
 * deferred-purchase read.
 *
 * @param rows - Rows to answer with, keyed by the imported table object.
 */
function stubDb(rows: TableRows): void {
    vi.mocked(getDb).mockImplementation(
        () =>
            ({
                select: () => ({
                    from: (table: unknown) => ({
                        where: async () => rows.get(table) ?? []
                    })
                })
            }) as any
    );
}

describe('loadEntitlements — deferred add-on grants reach the request (HOS-847 PR 7b)', () => {
    let app: Hono<AppBindings>;
    let mockBilling: {
        subscriptions: { getByCustomerId: ReturnType<typeof vi.fn> };
        plans: { get: ReturnType<typeof vi.fn> };
        entitlements: { getByCustomerId: ReturnType<typeof vi.fn> };
        limits: { getByCustomerId: ReturnType<typeof vi.fn> };
    };
    let getBySlugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
        mockBilling = {
            subscriptions: { getByCustomerId: vi.fn().mockResolvedValue([]) },
            plans: { get: vi.fn() },
            entitlements: { getByCustomerId: vi.fn().mockResolvedValue([]) },
            limits: { getByCustomerId: vi.fn().mockResolvedValue([]) }
        };
        vi.mocked(getQZPayBilling).mockReturnValue(
            mockBilling as unknown as ReturnType<typeof getQZPayBilling>
        );

        getBySlugSpy = vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation((async (
            slug: string
        ): Promise<any> => {
            if (slug === 'owner-basico') return { success: true, data: OWNER_BASICO };
            return { success: false, error: { code: 'NOT_FOUND', message: slug } };
        }) as never);

        // Default: nothing deferred. Individual tests opt in.
        stubDb(new Map());
        clearHostDraftDefaultsCache();
    });

    afterEach(() => {
        getBySlugSpy.mockRestore();
        vi.clearAllMocks();
    });

    /**
     * Mounts a HOST actor on `customerId`, the real middleware, and a route that
     * reports what the middleware resolved.
     *
     * @param customerId - QZPay customer id to resolve. MUST be unique per test:
     *   the entitlement cache is module-global and keyed by it.
     */
    function mount(customerId: string) {
        type InjectedActor = import('../../src/types').AppBindings['Variables']['actor'];
        clearEntitlementCache(customerId);
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', customerId);
            c.set('actor', {
                id: 'host-with-deferred-addon',
                roles: [RoleEnum.HOST],
                permissions: [],
                email: 'host-with-deferred-addon@example.com'
            } as unknown as InjectedActor);
            return next();
        });
        app.use(entitlementMiddleware());
        app.get('/test', (c) =>
            c.json({
                entitlements: Array.from(c.get('userEntitlements')).sort(),
                limits: Object.fromEntries(c.get('userLimits'))
            })
        );
    }

    /**
     * Runs one request through the middleware.
     *
     * @param customerId - QZPay customer id to resolve.
     * @returns What the route reported.
     */
    async function run(customerId: string) {
        mount(customerId);
        const res = await app.request('/test');
        expect(res.status).toBe(200);
        return (await res.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Record<string, number>;
        };
    }

    it('raises the fallback limit by the deferred add-on when the customer has NO subscription', async () => {
        // The `!rawSubscriptions.length` branch. Without the merge at this cut,
        // the answer is owner-basico's bare 1.
        stubDb(new Map([[billingAddonPurchases, [DEFERRED_PURCHASE_ROW]]]));

        const data = await run('cus-no-subs-with-deferred');

        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(5);
    });

    it('grants the deferred add-on ENTITLEMENT, not just the limit', async () => {
        // `owner-basico` deliberately does NOT declare FEATURED_LISTING, so the
        // key can only have arrived from the purchase row's
        // `entitlement_adjustments`.
        stubDb(new Map([[billingAddonPurchases, [DEFERRED_PURCHASE_ROW]]]));

        const data = await run('cus-no-subs-deferred-entitlement');

        expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
    });

    it('leaves the baseline alone when there is NO deferred add-on', async () => {
        // The control. Without it, an implementation that returned a constant 5
        // would satisfy the two cases above.
        stubDb(new Map());

        const data = await run('cus-no-subs-no-deferred');

        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(1);
        expect(data.entitlements).not.toContain(EntitlementKey.FEATURED_LISTING);
    });

    it('raises the fallback limit when the only subscription is CANCELLED', async () => {
        // The second cut, and the one that matters in production: this is the
        // branch a host lands on the day after their plan ends, holding an
        // add-on paid through the 25th.
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-cancelled', planId: 'plan-owner-pro', status: 'cancelled' }
        ]);
        stubDb(
            new Map<unknown, readonly unknown[]>([
                [billingAddonPurchases, [DEFERRED_PURCHASE_ROW]],
                // Hydration finds no row → productDomain null → accommodation
                // fail-open, which is what the pre-HOS-1104 fixtures assumed.
                [billingSubscriptions, []]
            ])
        );

        const data = await run('cus-cancelled-with-deferred');

        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(5);
        expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
    });

    it('leaves the baseline alone when the only subscription is cancelled and nothing was deferred', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-cancelled', planId: 'plan-owner-pro', status: 'cancelled' }
        ]);
        stubDb(new Map<unknown, readonly unknown[]>([[billingSubscriptions, []]]));

        const data = await run('cus-cancelled-no-deferred');

        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(1);
        expect(data.entitlements).not.toContain(EntitlementKey.FEATURED_LISTING);
    });

    it('does NOT re-serve one customer’s deferred add-on to the next HOST', async () => {
        // `buildHostDraftDefaultsResult` memoizes its result for five minutes and
        // hands the SAME object to every HOST request in the window. An in-place
        // merge would leak the add-on across customers, and the leak is only
        // visible when a second customer runs against the warm cache.
        stubDb(new Map([[billingAddonPurchases, [DEFERRED_PURCHASE_ROW]]]));
        const first = await run('cus-leak-source');
        expect(first.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(5);

        // Same warm `owner-basico` memo, different customer, nothing deferred.
        app = new Hono<AppBindings>();
        stubDb(new Map());
        const second = await run('cus-leak-victim');

        expect(second.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(1);
        expect(second.entitlements).not.toContain(EntitlementKey.FEATURED_LISTING);
    });
});

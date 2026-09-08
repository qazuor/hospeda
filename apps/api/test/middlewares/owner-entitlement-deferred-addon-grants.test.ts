/**
 * HOS-847 PR 7b — the two OWNER-side junctions with the deferred add-on grants.
 *
 * `entitlement.ts` resolves the REQUESTING user; this module resolves the OWNER
 * of the resource being read, and it cuts to a fallback in two more places:
 * `loadCustomerEntitlements` (no live accommodation subscription → empty set)
 * and the `owner-basico` limits fallback. Both return BEFORE the customer-level
 * merge, which is why PR 7a's deferral delivered nothing through either.
 *
 * Same instrument as `entitlement-deferred-addon-grants.test.ts`: the QZPay
 * client, the plan lookup and `getDb` are stubbed; `loadDeferredAddonGrants` and
 * `mergeDeferredAddonGrants` run for real, because stubbing them is exactly the
 * blindness these files exist to remove.
 *
 * Note this file does NOT re-mock `@repo/db` wholesale the way
 * `owner-entitlement.test.ts` does — that file's factory omits
 * `billingAddonPurchases`, `and`, `gt` and `isNull`, so the deferred read throws
 * there and is swallowed into a `degraded` answer. Riding the global `@repo/db`
 * mock from `test/setup.ts` and overriding only `getDb` keeps every operator
 * real.
 *
 * @module test/middlewares/owner-entitlement-deferred-addon-grants
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { billingAddonPurchases, getDb } from '@repo/db';
import { PlanService } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    resolveOwnerEntitlementsForOwnerId,
    resolveOwnerLimitsForOwnerId
} from '../../src/middlewares/owner-entitlement';

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Every owner here must be a cache MISS: this suite covers the LIVE resolution
// path, which is what a miss falls through to.
vi.mock('../../src/services/entity-subscription-cache.service', () => ({
    readAccommodationSubscriptionCacheByOwnerIds: vi.fn(async () => new Map())
}));

/** The fallback plan, and the baseline every assertion is measured against. */
const OWNER_BASICO = {
    id: 'plan-owner-basico',
    slug: 'owner-basico',
    name: 'Basic',
    entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS] as string[],
    limits: { [LimitKey.MAX_ACCOMMODATIONS]: 1 }
};

/** A cancelled add-on still inside the period it was charged for. */
const DEFERRED_PURCHASE_ROW = {
    id: 'purchase-extra-accommodations',
    addonSlug: 'extra-accommodations-5',
    limitAdjustments: [
        { limitKey: LimitKey.MAX_ACCOMMODATIONS, increase: 4, previousValue: 1, newValue: 5 }
    ],
    entitlementAdjustments: [{ entitlementKey: EntitlementKey.FEATURED_LISTING, granted: true }]
};

/**
 * Installs a `getDb` whose `select().from(table).where()` resolves per TABLE.
 *
 * The owner path issues three reads of this shape — the owner's `user_role`
 * hats, `hydrateSubscriptionProductDomains`, and the deferred purchases — so
 * routing by table identity is what keeps them from stealing each other's
 * answers. Unrouted tables resolve empty, which is the correct answer for the
 * first two here.
 *
 * @param rows - Rows to answer with, keyed by the imported table object.
 */
function stubDb(rows: ReadonlyMap<unknown, readonly unknown[]>): void {
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

describe('owner-entitlement — deferred add-on grants reach the owner fallbacks (HOS-847 PR 7b)', () => {
    let mockBilling: {
        customers: { getByExternalId: ReturnType<typeof vi.fn> };
        subscriptions: { getByCustomerId: ReturnType<typeof vi.fn> };
        plans: { get: ReturnType<typeof vi.fn> };
        entitlements: { getByCustomerId: ReturnType<typeof vi.fn> };
        limits: { getByCustomerId: ReturnType<typeof vi.fn> };
    };
    let getBySlugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockBilling = {
            customers: { getByExternalId: vi.fn() },
            // No live accommodation subscription — the branch under test.
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

        stubDb(new Map());
    });

    afterEach(() => {
        getBySlugSpy.mockRestore();
        vi.clearAllMocks();
    });

    // `ownerLimitsCache` is module-global, keyed by QZPay customerId, and has no
    // reset seam — every test below therefore uses a customerId of its own.
    describe('resolveOwnerLimitsForOwnerId — the owner-basico limits fallback', () => {
        it('raises the fallback limit by the deferred add-on', async () => {
            mockBilling.customers.getByExternalId.mockResolvedValue({
                id: 'cus-owner-limits-deferred'
            });
            stubDb(new Map([[billingAddonPurchases, [DEFERRED_PURCHASE_ROW]]]));

            const limits = await resolveOwnerLimitsForOwnerId('owner-limits-deferred');

            expect(limits.get(LimitKey.MAX_ACCOMMODATIONS)).toBe(5);
        });

        it('leaves the fallback limit at the baseline when nothing was deferred', async () => {
            mockBilling.customers.getByExternalId.mockResolvedValue({
                id: 'cus-owner-limits-plain'
            });
            stubDb(new Map());

            const limits = await resolveOwnerLimitsForOwnerId('owner-limits-plain');

            expect(limits.get(LimitKey.MAX_ACCOMMODATIONS)).toBe(1);
        });
    });

    describe('resolveOwnerEntitlementsForOwnerId — the empty-set fallback', () => {
        it('grants the deferred add-on entitlement to an owner with no live plan', async () => {
            mockBilling.customers.getByExternalId.mockResolvedValue({
                id: 'cus-owner-ents-deferred'
            });
            stubDb(new Map([[billingAddonPurchases, [DEFERRED_PURCHASE_ROW]]]));

            const entitlements = await resolveOwnerEntitlementsForOwnerId('owner-ents-deferred');

            expect(entitlements).toContain(EntitlementKey.FEATURED_LISTING);
        });

        it('answers with nothing when the owner has no live plan and nothing deferred', async () => {
            mockBilling.customers.getByExternalId.mockResolvedValue({
                id: 'cus-owner-ents-plain'
            });
            stubDb(new Map());

            const entitlements = await resolveOwnerEntitlementsForOwnerId('owner-ents-plain');

            expect(entitlements).toEqual([]);
        });
    });
});

/**
 * HOS-1303 — vertical isolation of the CONSUMER-SIDE entitlement loader,
 * exercised through the real middleware.
 *
 * ## The three seams, and why they are asserted here rather than in units
 *
 * `middlewares/entitlement.ts` is the only resolver that reads
 * `billing_customer_entitlements`, a table keyed `(customer_id,
 * entitlement_key)` with no vertical on it. Three separate reads inside it can
 * hand a host another vertical's grants, and each fails independently:
 *
 *   1. the customer-level UNION on the active-subscription path;
 *   2. the deferred add-on merge on the no-live-subscription path, which is a
 *      DIFFERENT branch reached by a different customer state — the gate on (1)
 *      is invisible from there;
 *   3. the subscription SELECTION itself, which decides whose plan is being
 *      merged onto in the first place.
 *
 * A unit test of the classifier proves none of that: it stays green with every
 * call site deleted. `test/services/billing/consumer-addon-grant-domain.test.ts`
 * carries the five-vertical classification; this file carries the wiring.
 *
 * ## What is mocked
 *
 * The QZPay client, `getDb` (routed by TABLE identity), and
 * `isOwnerCategorySubscription` (per plan id — the HOS-217 discard has to be
 * steerable to tell the two subscriptions of a dual owner apart). Everything
 * else runs: `selectAccommodationSubscription`, `hydrateSubscriptionProductDomains`,
 * `loadDeferredAddonGrants`, and the classifier under test.
 *
 * @module test/middlewares/entitlement-domain-isolation
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { billingAddonPurchases, billingSubscriptions, getDb } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { isOwnerCategorySubscription, PlanService, RoleEnum } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    clearEntitlementCache,
    clearHostDraftDefaultsCache,
    entitlementMiddleware
} from '../../src/middlewares/entitlement';
import type { AppBindings } from '../../src/types';
import { apiLogger } from '../../src/utils/logger';

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Partial mock via importOriginal: a whole-module `vi.mock` would leave
// `selectAccommodationSubscription`'s own imports (`subscriptionMatchesDomain`,
// `hydrateSubscriptionProductDomains`) undefined and quietly turn the selection
// assertions below into vacuous ones.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, isOwnerCategorySubscription: vi.fn() };
});

/** The host's own accommodation plan. Grants no FEATURED_LISTING of its own. */
const OWNER_PRO_PLAN = {
    id: 'plan-owner-pro',
    entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS, EntitlementKey.EDIT_ACCOMMODATION_INFO],
    limits: { [LimitKey.MAX_ACCOMMODATIONS]: 5 }
};

/** The tourist tier the same person signed up with before being promoted. */
const TOURIST_VIP_PLAN = {
    id: 'plan-tourist-vip',
    entitlements: [EntitlementKey.VIP_SUPPORT, EntitlementKey.SAVE_FAVORITES],
    limits: { [LimitKey.MAX_FAVORITES]: 100 }
};

/** The `owner-basico` draft-phase fallback, resolved by slug. */
const OWNER_BASICO = {
    id: 'plan-owner-basico',
    slug: 'owner-basico',
    name: 'Basic',
    entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS] as string[],
    limits: { [LimitKey.MAX_ACCOMMODATIONS]: 1 }
};

const ACC_SUBSCRIPTION = {
    id: 'sub-accommodation',
    planId: OWNER_PRO_PLAN.id,
    status: 'active',
    productDomain: 'accommodation'
};

const TOURIST_SUBSCRIPTION = {
    id: 'sub-tourist',
    planId: TOURIST_VIP_PLAN.id,
    status: 'active',
    productDomain: 'tourist'
};

/** Rows the routed `getDb` stub answers with, keyed by the table object. */
type TableRows = ReadonlyMap<unknown, readonly unknown[]>;

/**
 * Installs a `getDb` whose `select().from(table).where()` resolves per TABLE,
 * and whose result also answers `.limit()` for the callers that chain it.
 *
 * @param rows - Rows to answer with, keyed by the imported table object.
 */
function stubDb(rows: TableRows): void {
    vi.mocked(getDb).mockImplementation(
        () =>
            ({
                select: () => ({
                    from: (table: unknown) => ({
                        where: () => {
                            const result = rows.get(table) ?? [];
                            const promise = Promise.resolve(result) as Promise<
                                readonly unknown[]
                            > & {
                                limit?: (n: number) => Promise<readonly unknown[]>;
                            };
                            promise.limit = async () => result;
                            return promise;
                        }
                    })
                })
            }) as never
    );
}

describe('HOS-1303 — the consumer loader and other verticals', () => {
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
            plans: vi.fn() as never,
            entitlements: { getByCustomerId: vi.fn().mockResolvedValue([]) },
            limits: { getByCustomerId: vi.fn().mockResolvedValue([]) }
        } as never;
        mockBilling.plans = {
            get: vi.fn(async (planId: string) => {
                if (planId === OWNER_PRO_PLAN.id) return OWNER_PRO_PLAN;
                if (planId === TOURIST_VIP_PLAN.id) return TOURIST_VIP_PLAN;
                return null;
            })
        };
        vi.mocked(getQZPayBilling).mockReturnValue(
            mockBilling as unknown as ReturnType<typeof getQZPayBilling>
        );

        // Only the owner tier is an owner-category plan. This is what arms the
        // HOS-217 discard for the tourist row of a dual owner.
        vi.mocked(isOwnerCategorySubscription).mockImplementation(
            async (input: { planId: string }) => input.planId === OWNER_PRO_PLAN.id
        );

        getBySlugSpy = vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation((async (
            slug: string
        ): Promise<unknown> => {
            if (slug === 'owner-basico') return { success: true, data: OWNER_BASICO };
            return { success: false, error: { code: 'NOT_FOUND', message: slug } };
        }) as never);

        stubDb(new Map());
        clearHostDraftDefaultsCache();
    });

    afterEach(() => {
        getBySlugSpy.mockRestore();
        vi.clearAllMocks();
    });

    /**
     * Mounts an actor on `customerId`, the real middleware, and a reporting route.
     *
     * @param customerId - QZPay customer id. MUST be unique per test: the
     *   entitlement cache is module-global and keyed by it.
     * @param roles - Roles the actor holds. HOST arms the draft-defaults fallback
     *   and the HOS-217 discard.
     */
    function mount(customerId: string, roles: readonly RoleEnum[]) {
        type InjectedActor = import('../../src/types').AppBindings['Variables']['actor'];
        clearEntitlementCache(customerId);
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', customerId);
            c.set('actor', {
                id: `actor-${customerId}`,
                roles,
                permissions: [],
                email: `${customerId}@example.com`
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
     * @param roles - Roles the actor holds; defaults to HOST.
     * @returns What the route reported.
     */
    async function run(customerId: string, roles: readonly RoleEnum[] = [RoleEnum.HOST]) {
        mount(customerId, roles);
        const res = await app.request('/test');
        expect(res.status).toBe(200);
        return (await res.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Record<string, number>;
        };
    }

    // ─── Seam 1: the customer-level union ────────────────────────────────────

    describe('customer-level grants are merged by the vertical that bought them', () => {
        beforeEach(() => {
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([ACC_SUBSCRIPTION]);
        });

        it('does NOT merge a GASTRONOMY boost into the accommodation set', async () => {
            // The measured leak. `visibility-boost-gastronomy-7d` grants
            // FEATURED_LISTING — the very same key the accommodation boost
            // grants — so nothing about the row itself says which listing it
            // bought placement for. Before this gate the host's accommodation
            // surfaces reported featuring they never purchased.
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                {
                    entitlementKey: EntitlementKey.FEATURED_LISTING,
                    source: 'addon',
                    sourceId: 'purchase-gastronomy-boost'
                }
            ]);
            stubDb(
                new Map<unknown, readonly unknown[]>([
                    [
                        billingAddonPurchases,
                        [
                            {
                                id: 'purchase-gastronomy-boost',
                                addonSlug: 'visibility-boost-gastronomy-7d'
                            }
                        ]
                    ]
                ])
            );

            const data = await run('cus-gastronomy-boost');

            expect(data.entitlements).not.toContain(EntitlementKey.FEATURED_LISTING);
            // The plan's own grants are untouched — the gate drops one row, it
            // does not empty the union.
            expect(data.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
        });

        it('does NOT merge an EXPERIENCE add-on grant either', async () => {
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                {
                    entitlementKey: EntitlementKey.MANAGE_EXPERIENCE_PRIVATE_GALLERIES,
                    source: 'addon',
                    sourceId: 'purchase-galleries'
                }
            ]);
            stubDb(
                new Map<unknown, readonly unknown[]>([
                    [
                        billingAddonPurchases,
                        [{ id: 'purchase-galleries', addonSlug: 'private-galleries-5' }]
                    ]
                ])
            );

            const data = await run('cus-experience-galleries');

            expect(data.entitlements).not.toContain(
                EntitlementKey.MANAGE_EXPERIENCE_PRIVATE_GALLERIES
            );
        });

        it('DOES merge the accommodation boost — the gate is not "drop every add-on grant"', async () => {
            // The mutation-toward-too-wide direction. An implementation that
            // skipped every `source: 'addon'` row would pass the two cases above
            // and fail here.
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                {
                    entitlementKey: EntitlementKey.FEATURED_LISTING,
                    source: 'addon',
                    sourceId: 'purchase-accommodation-boost'
                }
            ]);
            stubDb(
                new Map<unknown, readonly unknown[]>([
                    [
                        billingAddonPurchases,
                        [{ id: 'purchase-accommodation-boost', addonSlug: 'visibility-boost-7d' }]
                    ]
                ])
            );

            const data = await run('cus-accommodation-boost');

            expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
        });

        it('merges the accommodation boost even when a gastronomy one sits beside it', async () => {
            // The dual owner: a host who also runs a restaurant and bought a
            // boost for each. One key, two rows, two verticals — the answer must
            // be "yes", and it must be yes because of the accommodation row.
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                {
                    entitlementKey: EntitlementKey.FEATURED_LISTING,
                    source: 'addon',
                    sourceId: 'purchase-gastronomy-boost'
                },
                {
                    entitlementKey: EntitlementKey.FEATURED_LISTING,
                    source: 'addon',
                    sourceId: 'purchase-accommodation-boost'
                }
            ]);
            stubDb(
                new Map<unknown, readonly unknown[]>([
                    [
                        billingAddonPurchases,
                        [
                            {
                                id: 'purchase-gastronomy-boost',
                                addonSlug: 'visibility-boost-gastronomy-7d'
                            },
                            {
                                id: 'purchase-accommodation-boost',
                                addonSlug: 'visibility-boost-7d'
                            }
                        ]
                    ]
                ])
            );

            const data = await run('cus-dual-owner-boosts');

            expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
        });

        it("keeps an ADMIN's manual grant, which belongs to no vertical", async () => {
            // `source: 'manual'` with a null `sourceId` is the admin grant route
            // (`routes/billing/admin/customer-entitlements.ts`). Dropping it would
            // be a behaviour regression dressed as a domain fix.
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                {
                    entitlementKey: EntitlementKey.FEATURED_LISTING,
                    source: 'manual',
                    sourceId: null
                }
            ]);
            stubDb(new Map());

            const data = await run('cus-manual-grant');

            expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
        });

        it('reports the drop at INFO, the level production actually emits', async () => {
            // HOS-1303 review F2. The first revision logged the drop at `debug`
            // and claimed in a docblock that every admitted case was logged too.
            // `LOG_LEVEL` defaults to `info` (`packages/config/src/env.ts`), so an
            // owner reporting "my featuring disappeared after the deploy" left no
            // line at all in staging or prod. Asserting the LEVEL, not merely that
            // something was logged, is the point: a `debug` call satisfies "it
            // logs" and still reaches nobody.
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                {
                    entitlementKey: EntitlementKey.FEATURED_LISTING,
                    source: 'addon',
                    sourceId: 'purchase-gastronomy-boost'
                },
                {
                    entitlementKey: EntitlementKey.AI_SUPPORT,
                    source: 'addon',
                    sourceId: 'purchase-vanished'
                }
            ]);
            stubDb(
                new Map<unknown, readonly unknown[]>([
                    [
                        billingAddonPurchases,
                        [
                            {
                                id: 'purchase-gastronomy-boost',
                                addonSlug: 'visibility-boost-gastronomy-7d'
                            }
                        ]
                    ]
                ])
            );

            await run('cus-reports-at-info');

            expect(apiLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    resolver: 'consumer-entitlements',
                    dropped: [
                        expect.objectContaining({
                            entitlementKey: EntitlementKey.FEATURED_LISTING,
                            addonSlug: 'visibility-boost-gastronomy-7d',
                            addonDomain: ProductDomainEnum.GASTRONOMY
                        })
                    ],
                    // The fail-open firing, which the docblock claimed was logged
                    // and was not. A steady stream of these is the signature of the
                    // gate having gone no-op.
                    admittedUnplaceable: [
                        expect.objectContaining({
                            entitlementKey: EntitlementKey.AI_SUPPORT,
                            purchaseId: 'purchase-vanished'
                        })
                    ]
                }),
                expect.stringContaining('add-on grant domain gate')
            );
        });

        it('stays silent when the gate did nothing — no info line per request', async () => {
            // The control for the case above. An unconditional `info` on a path
            // that runs on every entitlement-cache miss would be noise, and noise
            // is how a real signal stops being read.
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            stubDb(new Map());

            await run('cus-nothing-to-report');

            expect(apiLogger.info).not.toHaveBeenCalled();
        });

        it('keeps a grant whose purchase row cannot be found — unplaceable is not foreign', async () => {
            // The posture inversion versus HOS-1279, at the seam. A grant whose
            // purchase was hard-deleted is a data gap, not evidence of another
            // vertical, and refusing it takes a paid feature away.
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([
                {
                    entitlementKey: EntitlementKey.FEATURED_LISTING,
                    source: 'addon',
                    sourceId: 'purchase-vanished'
                }
            ]);
            stubDb(new Map<unknown, readonly unknown[]>([[billingAddonPurchases, []]]));

            const data = await run('cus-missing-purchase');

            expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
        });
    });

    // ─── Seam 2: the DEFERRED merge, on the other branch ─────────────────────

    describe('deferred add-on grants are scoped to the same two verticals', () => {
        it('does NOT fold a deferred GASTRONOMY boost into a host with no live plan', async () => {
            // The `!activeSubscription` branch: the customer-level union above
            // never runs here, so this gate is genuinely a second one. Without it
            // a cancelled restaurant boost featured the host's accommodations.
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([]);
            stubDb(
                new Map<unknown, readonly unknown[]>([
                    [
                        billingAddonPurchases,
                        [
                            {
                                id: 'deferred-gastronomy-boost',
                                addonSlug: 'visibility-boost-gastronomy-30d',
                                limitAdjustments: [],
                                entitlementAdjustments: [
                                    {
                                        entitlementKey: EntitlementKey.FEATURED_LISTING,
                                        granted: true
                                    }
                                ]
                            }
                        ]
                    ]
                ])
            );

            const data = await run('cus-deferred-gastronomy');

            expect(data.entitlements).not.toContain(EntitlementKey.FEATURED_LISTING);
            // The fallback itself still resolved — the filter drops one row, it
            // does not degrade the branch.
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(1);
        });

        it('DOES fold a deferred ACCOMMODATION add-on, limits and entitlements alike', async () => {
            // The other direction. An over-wide filter that dropped every
            // deferred row would pass the case above and fail this one — and
            // would silently un-deliver what HOS-847 was written to deliver.
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([]);
            stubDb(
                new Map<unknown, readonly unknown[]>([
                    [
                        billingAddonPurchases,
                        [
                            {
                                id: 'deferred-accommodation-addon',
                                addonSlug: 'extra-accommodations-5',
                                limitAdjustments: [
                                    {
                                        limitKey: LimitKey.MAX_ACCOMMODATIONS,
                                        increase: 4,
                                        previousValue: 1,
                                        newValue: 5
                                    }
                                ],
                                entitlementAdjustments: [
                                    {
                                        entitlementKey: EntitlementKey.FEATURED_LISTING,
                                        granted: true
                                    }
                                ]
                            }
                        ]
                    ]
                ])
            );

            const data = await run('cus-deferred-accommodation');

            expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(5);
        });
    });

    // ─── Seam 3: WHOSE plan is being merged onto ─────────────────────────────

    describe('the dual owner resolves their ACCOMMODATION plan, whatever the row order', () => {
        it('resolves the owner plan when the TOURIST row comes back first', async () => {
            // The regression this seam exists for. The old single `find` matched
            // `isAccommodationSubscription(sub) || matchesDomain(sub, TOURIST)`
            // in one pass, so row order decided. With the tourist row first, the
            // HOS-217 discard then threw the (non-owner-category) tourist plan
            // away and served a PAYING owner-pro host the owner-basico draft
            // defaults.
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                TOURIST_SUBSCRIPTION,
                ACC_SUBSCRIPTION
            ]);
            stubDb(new Map<unknown, readonly unknown[]>([[billingSubscriptions, []]]));

            const data = await run('cus-dual-tourist-first');

            expect(data.entitlements).toContain(EntitlementKey.EDIT_ACCOMMODATION_INFO);
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(5);
        });

        it('resolves the same owner plan when the ACCOMMODATION row comes back first', async () => {
            // The control: the answer must not depend on the order at all.
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                ACC_SUBSCRIPTION,
                TOURIST_SUBSCRIPTION
            ]);
            stubDb(new Map<unknown, readonly unknown[]>([[billingSubscriptions, []]]));

            const data = await run('cus-dual-accommodation-first');

            expect(data.entitlements).toContain(EntitlementKey.EDIT_ACCOMMODATION_INFO);
            expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(5);
        });

        it('still resolves a pure TOURIST subscriber, who has no accommodation row', async () => {
            // The mutation-toward-too-narrow direction: an accommodation-only
            // selection would hand a paying tourist-VIP the tourist-FREE
            // defaults, which is the HOS-1233 bug this pair must not re-open.
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([TOURIST_SUBSCRIPTION]);
            stubDb(new Map<unknown, readonly unknown[]>([[billingSubscriptions, []]]));

            const data = await run('cus-pure-tourist', [RoleEnum.USER]);

            expect(data.entitlements).toContain(EntitlementKey.VIP_SUPPORT);
            expect(data.limits[LimitKey.MAX_FAVORITES]).toBe(100);
        });

        it('never resolves a COMMERCE subscription, even as the only one there is', async () => {
            // The third direction: gastronomy fails CLOSED, so a restaurant
            // owner with no accommodation and no tourist plan lands on the
            // fallback rather than borrowing their commerce tier's grants.
            //
            // Run as a non-HOST deliberately. With the HOST hat on, the HOS-217
            // discard would throw a wrongly-selected commerce subscription away
            // for its own reason (not owner-category) and hide the selection
            // defect behind a correct-looking answer — the `plans.get` assertion
            // below would then hold even for a selector that picked it.
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                {
                    id: 'sub-gastronomy',
                    planId: 'plan-gastronomy-premium',
                    status: 'active',
                    productDomain: 'gastronomy'
                }
            ]);
            stubDb(new Map<unknown, readonly unknown[]>([[billingSubscriptions, []]]));

            const data = await run('cus-commerce-only', [RoleEnum.USER]);

            // Tourist-free defaults, not the gastronomy tier's grants.
            expect(data.entitlements).toContain(EntitlementKey.SAVE_FAVORITES);
            expect(data.entitlements).not.toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(mockBilling.plans.get).not.toHaveBeenCalled();
        });
    });
});

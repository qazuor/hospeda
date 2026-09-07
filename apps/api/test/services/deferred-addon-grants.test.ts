/**
 * `deferred-addon-grants.service` — the arithmetic, in isolation (HOS-847 PR 7b).
 *
 * The behaviour that MATTERS (a request actually seeing the raised limit) is
 * asserted end-to-end against a real row in
 * `test/e2e/flows/billing/deferred-addon-entitlements.test.ts`, because a mock
 * cannot tell you whether the resolver reached this code at all — which is
 * exactly how PR 7a shipped a deferral that granted nothing.
 *
 * What is left for a unit test is the part an e2e fixture cannot cheaply cover:
 * the two limit edge cases (`-1` unlimited, and a key the fallback plan does not
 * declare), summing across several add-ons, and the degraded answer.
 *
 * @module test/services/deferred-addon-grants
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { getDb } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type DeferredAddonGrants,
    loadDeferredAddonGrants,
    mergeDeferredAddonGrants
} from '../../src/services/deferred-addon-grants.service.js';

/**
 * Builds a grants object without going through the DB.
 *
 * @param overrides - Fields to override on the empty default.
 * @returns A {@link DeferredAddonGrants}.
 */
function grants(overrides: Partial<DeferredAddonGrants> = {}): DeferredAddonGrants {
    return {
        entitlements: new Set<EntitlementKey>(),
        limitIncrements: new Map<LimitKey, number>(),
        purchaseIds: [],
        degraded: false,
        ...overrides
    };
}

describe('mergeDeferredAddonGrants', () => {
    it('adds the increase on top of the baseline instead of replacing it', () => {
        const { limits } = mergeDeferredAddonGrants({
            grants: grants({ limitIncrements: new Map([[LimitKey.MAX_FAVORITES, 10]]) }),
            entitlements: new Set<EntitlementKey>(),
            limits: new Map([[LimitKey.MAX_FAVORITES, 5]])
        });

        expect(limits.get(LimitKey.MAX_FAVORITES)).toBe(15);
    });

    it('leaves an UNLIMITED baseline alone', () => {
        // `-1` is the unlimited sentinel platform-wide. Adding to it would turn
        // "no cap" into a cap of nine, which reads as a paid add-on REMOVING an
        // allowance.
        const { limits } = mergeDeferredAddonGrants({
            grants: grants({ limitIncrements: new Map([[LimitKey.MAX_FAVORITES, 10]]) }),
            entitlements: new Set<EntitlementKey>(),
            limits: new Map([[LimitKey.MAX_FAVORITES, -1]])
        });

        expect(limits.get(LimitKey.MAX_FAVORITES)).toBe(-1);
    });

    it('treats a key the fallback plan does not declare as a baseline of zero', () => {
        const { limits } = mergeDeferredAddonGrants({
            grants: grants({ limitIncrements: new Map([[LimitKey.MAX_ACCOMMODATIONS, 20]]) }),
            entitlements: new Set<EntitlementKey>(),
            limits: new Map<LimitKey, number>()
        });

        expect(limits.get(LimitKey.MAX_ACCOMMODATIONS)).toBe(20);
    });

    it('unions entitlements onto the baseline', () => {
        const { entitlements } = mergeDeferredAddonGrants({
            grants: grants({ entitlements: new Set([EntitlementKey.FEATURED_LISTING]) }),
            entitlements: new Set([EntitlementKey.SAVE_FAVORITES]),
            limits: new Map<LimitKey, number>()
        });

        expect(entitlements).toEqual(
            new Set([EntitlementKey.SAVE_FAVORITES, EntitlementKey.FEATURED_LISTING])
        );
    });

    it('never mutates the collections it was handed', () => {
        // `buildHostDraftDefaultsResult` returns a MEMOIZED result shared by
        // every HOST request for five minutes. An in-place merge would grant one
        // customer's add-on to all of them.
        const baseEntitlements = new Set([EntitlementKey.SAVE_FAVORITES]);
        const baseLimits = new Map([[LimitKey.MAX_FAVORITES, 5]]);

        mergeDeferredAddonGrants({
            grants: grants({
                entitlements: new Set([EntitlementKey.FEATURED_LISTING]),
                limitIncrements: new Map([[LimitKey.MAX_FAVORITES, 10]])
            }),
            entitlements: baseEntitlements,
            limits: baseLimits
        });

        expect(baseEntitlements).toEqual(new Set([EntitlementKey.SAVE_FAVORITES]));
        expect(baseLimits.get(LimitKey.MAX_FAVORITES)).toBe(5);
    });
});

describe('loadDeferredAddonGrants', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sums the increase of two add-ons that raise the same key', async () => {
        vi.mocked(getDb).mockReturnValueOnce({
            select: () => ({
                from: () => ({
                    where: async () => [
                        {
                            id: 'p1',
                            addonSlug: 'extra-favorites-10',
                            limitAdjustments: [
                                {
                                    limitKey: 'max_favorites',
                                    increase: 10,
                                    previousValue: 5,
                                    newValue: 15
                                }
                            ],
                            entitlementAdjustments: []
                        },
                        {
                            id: 'p2',
                            addonSlug: 'extra-favorites-10',
                            limitAdjustments: [
                                {
                                    limitKey: 'max_favorites',
                                    increase: 7,
                                    previousValue: 5,
                                    newValue: 12
                                }
                            ],
                            entitlementAdjustments: [
                                { entitlementKey: 'featured_listing', granted: true }
                            ]
                        }
                    ]
                })
            })
        } as any);

        const result = await loadDeferredAddonGrants({ customerId: 'cus_1' });

        expect(result.limitIncrements.get(LimitKey.MAX_FAVORITES)).toBe(17);
        expect(result.entitlements).toEqual(new Set([EntitlementKey.FEATURED_LISTING]));
        expect(result.purchaseIds).toEqual(['p1', 'p2']);
        expect(result.degraded).toBe(false);
    });

    it('drops an adjustment naming a key this platform does not know', async () => {
        vi.mocked(getDb).mockReturnValueOnce({
            select: () => ({
                from: () => ({
                    where: async () => [
                        {
                            id: 'p1',
                            addonSlug: 'retired-addon',
                            limitAdjustments: [
                                {
                                    limitKey: 'max_unicorns',
                                    increase: 99,
                                    previousValue: 0,
                                    newValue: 99
                                }
                            ],
                            entitlementAdjustments: [
                                { entitlementKey: 'ride_unicorns', granted: true }
                            ]
                        }
                    ]
                })
            })
        } as any);

        const result = await loadDeferredAddonGrants({ customerId: 'cus_1' });

        expect(result.limitIncrements.size).toBe(0);
        expect(result.entitlements.size).toBe(0);
    });

    it('ignores an adjustment that records a REVOKED entitlement', async () => {
        vi.mocked(getDb).mockReturnValueOnce({
            select: () => ({
                from: () => ({
                    where: async () => [
                        {
                            id: 'p1',
                            addonSlug: 'extra-favorites-10',
                            limitAdjustments: [],
                            entitlementAdjustments: [
                                { entitlementKey: 'featured_listing', granted: false }
                            ]
                        }
                    ]
                })
            })
        } as any);

        const result = await loadDeferredAddonGrants({ customerId: 'cus_1' });

        expect(result.entitlements.size).toBe(0);
    });

    it('answers empty and DEGRADED when the lookup throws', async () => {
        // Degraded must be distinguishable from "no deferred add-ons": the
        // caller turns it into `shouldCache: false`, so an under-grant is not
        // frozen for the whole 5-minute TTL.
        vi.mocked(getDb).mockImplementationOnce(() => {
            throw new Error('connection reset');
        });

        const result = await loadDeferredAddonGrants({ customerId: 'cus_1' });

        expect(result.degraded).toBe(true);
        expect(result.entitlements.size).toBe(0);
        expect(result.limitIncrements.size).toBe(0);
    });
});

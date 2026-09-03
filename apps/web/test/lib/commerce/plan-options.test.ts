/**
 * @file plan-options.test.ts
 * @description Coverage for the commerce tier-diff derivation (HOS-1119) —
 * "what does this tier add over the previous one", the CELL that
 * `CommercePlanPicker` renders per tier.
 */

import { describe, expect, it } from 'vitest';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import {
    type CommercePlanOption,
    deriveCommercePlanTierDiffs,
    toCommercePlanOption
} from '@/lib/commerce/plan-options';

/** Minimal `CommercePlanOption` fixture. */
function option(
    input: Partial<CommercePlanOption> & Pick<CommercePlanOption, 'slug'>
): CommercePlanOption {
    return {
        name: input.slug,
        monthlyPriceArs: 1_500_000,
        entitlements: [],
        sortOrder: 1,
        ...input
    };
}

describe('toCommercePlanOption', () => {
    it('reduces a full PublicPlanData row to the narrow serializable shape', () => {
        const plan: PublicPlanData = {
            id: 'plan-id',
            slug: 'gastronomy-pro',
            name: 'Gastronomía Profesional',
            description: 'desc',
            category: 'owner',
            monthlyPriceArs: 4_500_000,
            annualPriceArs: null,
            monthlyPriceUsdRef: 45,
            hasTrial: true,
            trialDays: 30,
            isDefault: false,
            sortOrder: 2,
            isActive: true,
            entitlements: ['manage_gastronomy_menu'],
            limits: {},
            createdAt: '',
            updatedAt: ''
        };

        expect(toCommercePlanOption(plan)).toEqual({
            slug: 'gastronomy-pro',
            name: 'Gastronomía Profesional',
            monthlyPriceArs: 4_500_000,
            entitlements: ['manage_gastronomy_menu'],
            sortOrder: 2
        });
    });
});

describe('deriveCommercePlanTierDiffs', () => {
    it('the cheapest tier adds nothing — there is no "previous" tier to compare against', () => {
        const diffs = deriveCommercePlanTierDiffs([
            option({ slug: 'gastronomy-basico', sortOrder: 1, entitlements: [] })
        ]);

        expect(diffs).toHaveLength(1);
        expect(diffs[0]?.addedEntitlements).toEqual([]);
    });

    it('a dearer tier lists only the entitlements the cheaper tier lacks', () => {
        const diffs = deriveCommercePlanTierDiffs([
            option({ slug: 'gastronomy-basico', sortOrder: 1, entitlements: [] }),
            option({
                slug: 'gastronomy-pro',
                sortOrder: 2,
                entitlements: ['manage_gastronomy_menu']
            })
        ]);

        expect(diffs.map((d) => d.plan.slug)).toEqual(['gastronomy-basico', 'gastronomy-pro']);
        expect(diffs[0]?.addedEntitlements).toEqual([]);
        expect(diffs[1]?.addedEntitlements).toEqual(['manage_gastronomy_menu']);
    });

    it('sorts by sortOrder regardless of input order', () => {
        const diffs = deriveCommercePlanTierDiffs([
            option({
                slug: 'gastronomy-pro',
                sortOrder: 2,
                entitlements: ['manage_gastronomy_menu']
            }),
            option({ slug: 'gastronomy-basico', sortOrder: 1, entitlements: [] })
        ]);

        expect(diffs.map((d) => d.plan.slug)).toEqual(['gastronomy-basico', 'gastronomy-pro']);
    });

    it('an entitlement already granted by a CHEAPER tier is never re-listed by a THIRD, dearer tier', () => {
        // Cumulative, not just-the-immediately-previous-tier: a 3-tier ladder
        // must not re-advertise the base tier's own entitlement as if the top
        // tier were the one introducing it.
        const diffs = deriveCommercePlanTierDiffs([
            option({ slug: 'basico', sortOrder: 1, entitlements: ['feature_a'] }),
            option({ slug: 'pro', sortOrder: 2, entitlements: ['feature_a', 'feature_b'] }),
            option({
                slug: 'premium',
                sortOrder: 3,
                entitlements: ['feature_a', 'feature_b', 'feature_c']
            })
        ]);

        expect(diffs[0]?.addedEntitlements).toEqual([]);
        expect(diffs[1]?.addedEntitlements).toEqual(['feature_b']);
        expect(diffs[2]?.addedEntitlements).toEqual(['feature_c']);
    });

    it('returns an empty list for an empty input', () => {
        expect(deriveCommercePlanTierDiffs([])).toEqual([]);
    });
});

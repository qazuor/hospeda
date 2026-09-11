/**
 * Regression tests for `getChangePlanOptions` (HOS-331).
 *
 * The change-plan dialog used to filter `ALL_PLANS` by category and current
 * slug only. `isActive` was never consulted, so retired plans stayed on offer:
 * the three `complex-*` tiers are switched off, and a complex subscription's
 * change-plan list was made up entirely of them.
 *
 * The assertions below are derived from the catalog rather than hard-coded to
 * today's slugs, so switching a plan on or off updates the expectation instead
 * of breaking the test for the wrong reason.
 *
 * @module test/billing-subscriptions/change-plan-options.test
 */

import { ALL_PLANS, type PlanDefinition } from '@repo/billing';
import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getChangePlanOptions, getPlanBySlug } from '@/features/billing-subscriptions/utils';

/**
 * A retired plan, supplied by this test rather than read out of `ALL_PLANS`.
 *
 * These assertions used to derive their retired plan from the catalog, which
 * worked as long as the catalog happened to contain one. It no longer does:
 * HOS-692 removed the `complex-*` tiers and HOS-1224 removed `tourist-plus`,
 * the last `isActive: false` entry, so `ALL_PLANS` is now all-active.
 *
 * The weak fix would be to relax the "guards the guard" assertion below. That
 * is exactly backwards — over an all-active catalog every assertion here passes
 * no matter what the filter does, which is the vacuous green HOS-331 was about.
 * So the retired plan is constructed here and injected, and the assertions keep
 * their teeth regardless of what the real catalog holds.
 */
const RETIRED_TOURIST_PLAN: PlanDefinition = {
    slug: 'test-retired-tourist',
    name: 'Retired',
    description: 'Test-only retired plan — never part of ALL_PLANS.',
    category: 'tourist',
    productDomain: ProductDomainEnum.TOURIST,
    monthlyPriceArs: 500000,
    annualPriceArs: 5000000,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 99,
    isActive: false,
    entitlements: [],
    limits: []
};

/** The real catalog plus one retired plan, so `isActive` has something to filter. */
const CATALOG: readonly PlanDefinition[] = [...ALL_PLANS, RETIRED_TOURIST_PLAN];

const INACTIVE_PLANS = CATALOG.filter((plan) => !plan.isActive);
const ACTIVE_PLANS = CATALOG.filter((plan) => plan.isActive);

describe('getChangePlanOptions — retired plans (HOS-331)', () => {
    it('has both an active and an inactive plan in the catalog to discriminate on', () => {
        // Guards the guard: with an all-active catalog every assertion below
        // would pass no matter what the filter does.
        expect(INACTIVE_PLANS.length).toBeGreaterThan(0);
        expect(ACTIVE_PLANS.length).toBeGreaterThan(0);
    });

    it('never offers an inactive plan as a change destination', () => {
        const inactiveSlugs = new Set(INACTIVE_PLANS.map((plan) => plan.slug));
        for (const plan of CATALOG) {
            const options = getChangePlanOptions({
                currentPlan: plan,
                currentSlug: plan.slug,
                plans: CATALOG
            });
            const offendingSlugs = options
                .map((option) => option.slug)
                .filter((slug) => inactiveSlugs.has(slug));
            expect(offendingSlugs).toEqual([]);
        }
    });

    it('offers nothing when every sibling in the category is retired', () => {
        // The concrete shape of the original bug: a complex subscription had
        // three destinations, all of them switched off.
        const retired = INACTIVE_PLANS[0];
        if (!retired) throw new Error('expected at least one inactive plan');
        const siblingsActive = CATALOG.filter(
            (plan) =>
                plan.category === retired.category && plan.slug !== retired.slug && plan.isActive
        );
        const options = getChangePlanOptions({
            currentPlan: retired,
            currentSlug: retired.slug,
            plans: CATALOG
        });
        expect(options.map((option) => option.slug)).toEqual(
            siblingsActive.map((plan) => plan.slug)
        );
    });

    it('the real ALL_PLANS catalog is filtered by the same rule', () => {
        // The injected catalog above proves the FILTER works. This proves the
        // production default is still wired to it: every option the real
        // catalog yields is active and is not the plan being changed from.
        for (const plan of ALL_PLANS) {
            const options = getChangePlanOptions({ currentPlan: plan, currentSlug: plan.slug });
            for (const option of options) {
                expect(option.isActive).toBe(true);
                expect(option.slug).not.toBe(plan.slug);
                expect(option.category).toBe(plan.category);
            }
        }
    });
});

describe('getChangePlanOptions — category and self filtering', () => {
    it('offers every active sibling of the same category', () => {
        // Spelled out rather than derived: rebuilding `expected` with the same
        // predicate the function uses makes the assertion incapable of failing
        // on a predicate bug, which is the only bug worth testing for here.
        const current = getPlanBySlug('owner-basico');
        expect(current).toBeDefined();
        const options = getChangePlanOptions({
            currentPlan: current,
            currentSlug: 'owner-basico'
        });
        expect(options.map((option) => option.slug)).toEqual(['owner-pro', 'owner-premium']);
    });

    it('never offers the current plan back to itself', () => {
        for (const plan of ACTIVE_PLANS) {
            const options = getChangePlanOptions({
                currentPlan: plan,
                currentSlug: plan.slug
            });
            expect(options.map((option) => option.slug)).not.toContain(plan.slug);
        }
    });

    it('never crosses category boundaries', () => {
        for (const plan of ALL_PLANS) {
            const options = getChangePlanOptions({
                currentPlan: plan,
                currentSlug: plan.slug
            });
            for (const option of options) {
                expect(option.category).toBe(plan.category);
            }
        }
    });

    it('returns nothing when the current plan slug is unknown', () => {
        expect(
            getChangePlanOptions({ currentPlan: undefined, currentSlug: 'does-not-exist' })
        ).toEqual([]);
    });
});

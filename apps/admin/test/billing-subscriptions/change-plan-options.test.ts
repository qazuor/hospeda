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

import { ALL_PLANS } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import { getChangePlanOptions, getPlanBySlug } from '@/features/billing-subscriptions/utils';

const INACTIVE_PLANS = ALL_PLANS.filter((plan) => !plan.isActive);
const ACTIVE_PLANS = ALL_PLANS.filter((plan) => plan.isActive);

describe('getChangePlanOptions — retired plans (HOS-331)', () => {
    it('has both an active and an inactive plan in the catalog to discriminate on', () => {
        // Guards the guard: with an all-active catalog every assertion below
        // would pass no matter what the filter does.
        expect(INACTIVE_PLANS.length).toBeGreaterThan(0);
        expect(ACTIVE_PLANS.length).toBeGreaterThan(0);
    });

    it('never offers an inactive plan as a change destination', () => {
        const inactiveSlugs = new Set(INACTIVE_PLANS.map((plan) => plan.slug));
        for (const plan of ALL_PLANS) {
            const options = getChangePlanOptions({
                currentPlan: plan,
                currentSlug: plan.slug
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
        const siblingsActive = ALL_PLANS.filter(
            (plan) =>
                plan.category === retired.category && plan.slug !== retired.slug && plan.isActive
        );
        const options = getChangePlanOptions({
            currentPlan: retired,
            currentSlug: retired.slug
        });
        expect(options.map((option) => option.slug)).toEqual(
            siblingsActive.map((plan) => plan.slug)
        );
    });
});

describe('getChangePlanOptions — category and self filtering', () => {
    it('offers every active sibling of the same category', () => {
        const current = getPlanBySlug('owner-basico');
        expect(current).toBeDefined();
        const expected = ALL_PLANS.filter(
            (plan) => plan.category === 'owner' && plan.slug !== 'owner-basico' && plan.isActive
        ).map((plan) => plan.slug);
        const options = getChangePlanOptions({
            currentPlan: current,
            currentSlug: 'owner-basico'
        });
        expect(options.map((option) => option.slug)).toEqual(expected);
        expect(expected.length).toBeGreaterThan(0);
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

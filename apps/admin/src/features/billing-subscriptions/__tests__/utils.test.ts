/**
 * Regression tests for two billing-subscriptions vocabulary/config bugs.
 *
 * 1. `getStatusVariant`/`getStatusLabel` only knew 6 of the 9 real
 *    `AdminSubscriptionViewStatusSchema` values — `abandoned` and
 *    `pending_provider` fell through to `undefined`.
 *
 * 2. `getChangePlanOptions` (HOS-331 follow-up trap): once a subscription's
 *    `planSlug` starts arriving correctly, a commerce/partner-domain
 *    subscription's current plan can resolve to a `PlanDefinition` whose
 *    `category` is stamped `'owner'` purely to satisfy the `PlanCategory`
 *    type (see `packages/billing/src/config/plans.config.ts` — `commerce-listing`,
 *    `partner-listing`, `partner-silver`, `partner-gold`). Filtering
 *    `ALL_PLANS` by category alone would then offer an operator
 *    `owner-basico` as a "same family" destination for a `partner-gold`
 *    subscription. `getChangePlanOptions` must also gate on `productDomain`
 *    — served directly by the admin billing view contract — independent of
 *    the ALL_PLANS category lookup.
 */

import type { PlanDefinition } from '@repo/billing';
import type { AdminSubscriptionViewStatus } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getChangePlanOptions, getStatusLabel, getStatusVariant } from '../utils';

/** Every status value the contract actually declares (AdminSubscriptionViewStatusSchema). */
const ALL_SUBSCRIPTION_STATUSES: AdminSubscriptionViewStatus[] = [
    'active',
    'trialing',
    'past_due',
    'paused',
    'cancelled',
    'expired',
    'pending_provider',
    'abandoned',
    'comp'
];

describe('billing-subscriptions utils — status vocabulary', () => {
    it.each(
        ALL_SUBSCRIPTION_STATUSES
    )('returns a defined badge variant and label for status "%s"', (status) => {
        expect(getStatusVariant(status)).toBeDefined();
        const label = getStatusLabel(status, (key) => key);
        expect(label).toBeDefined();
        expect(label).not.toBe('');
    });
});

/**
 * A plan stamped `category: 'owner'` purely to satisfy `PlanCategory`, exactly
 * like `PARTNER_GOLD_PLAN` in plans.config.ts — its REAL discriminator is
 * `product_domain`, not `category`.
 */
const fakePartnerGoldLikePlan: PlanDefinition = {
    slug: 'partner-gold',
    name: 'Partner Gold',
    description: 'Partner tier plan (test fixture mirroring plans.config.ts)',
    category: 'owner',
    monthlyPriceArs: 3000000,
    annualPriceArs: 30000000,
    monthlyPriceUsdRef: 30,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 3,
    isActive: true,
    entitlements: [],
    limits: []
};

describe('getChangePlanOptions — cross-domain change trap (HOS-331 follow-up)', () => {
    it('never offers accommodation plans to a commerce/partner-domain subscription, even when the current plan carries category "owner"', () => {
        const options = getChangePlanOptions({
            currentPlan: fakePartnerGoldLikePlan,
            currentSlug: 'partner-gold',
            currentProductDomain: 'partner'
        });

        expect(options).toEqual([]);
        expect(options.some((plan) => plan.slug === 'owner-basico')).toBe(false);
    });

    it('blocks a commerce-domain subscription the same way', () => {
        const options = getChangePlanOptions({
            currentPlan: { ...fakePartnerGoldLikePlan, slug: 'commerce-listing' },
            currentSlug: 'commerce-listing',
            currentProductDomain: 'commerce'
        });

        expect(options).toEqual([]);
    });

    it('still offers same-category accommodation plans for an accommodation-domain subscription', () => {
        const options = getChangePlanOptions({
            currentPlan: { ...fakePartnerGoldLikePlan, slug: 'owner-basico', category: 'owner' },
            currentSlug: 'owner-basico',
            currentProductDomain: 'accommodation'
        });

        expect(options.length).toBeGreaterThan(0);
        expect(options.every((plan) => plan.category === 'owner')).toBe(true);
    });

    it('returns [] when there is no current plan, regardless of domain', () => {
        expect(
            getChangePlanOptions({
                currentPlan: undefined,
                currentSlug: 'unknown-slug',
                currentProductDomain: 'accommodation'
            })
        ).toEqual([]);
    });
});

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
import { type AdminSubscriptionViewStatus, ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getChangePlanOptions, getPlanBySlug, getStatusLabel, getStatusVariant } from '../utils';

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
    // The real discriminator, and as of HOS-1233 the fixture can finally state
    // it instead of only describing it in the comment above.
    productDomain: ProductDomainEnum.PARTNER,
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
            // The domain has to be corrected along with the slug and category:
            // this used to spread the partner fixture whole and call the result
            // `owner-basico`, which passed only while the gate read nothing but
            // `currentProductDomain`. A plan is not an accommodation plan
            // because its slug says so.
            currentPlan: {
                ...fakePartnerGoldLikePlan,
                slug: 'owner-basico',
                category: 'owner',
                productDomain: ProductDomainEnum.ACCOMMODATION
            },
            currentSlug: 'owner-basico',
            currentProductDomain: 'accommodation'
        });

        expect(options.length).toBeGreaterThan(0);
        expect(options.every((plan) => plan.category === 'owner')).toBe(true);
        expect(
            options.every((plan) => plan.productDomain === ProductDomainEnum.ACCOMMODATION)
        ).toBe(true);
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

/**
 * HOS-1233 T-039 / AC-15j — the read the reclassification BREAKS.
 *
 * A tourist subscription passed the old `!== 'accommodation'` gate only because
 * its row was misfiled as accommodation (spec F-4b). Reclassified, that gate
 * returned zero destinations for every tourist subscription — a silent
 * regression in a surface nobody would think to re-test.
 *
 * The first test below is the one that matters: it reproduces the CORRECTED
 * shape (a tourist row on a tourist plan) and fails against the old gate, which
 * is what the spec's §9 demands of a read regression — a fixture built with the
 * misfiled shape would have passed before the fix too.
 */
describe('getChangePlanOptions — a tourist subscription keeps its destinations', () => {
    const touristVip = getPlanBySlug('tourist-vip');

    it('offers the tourist plans to a correctly-classified tourist subscription', () => {
        expect(touristVip).toBeDefined();
        const options = getChangePlanOptions({
            currentPlan: touristVip,
            currentSlug: 'tourist-vip',
            currentProductDomain: ProductDomainEnum.TOURIST
        });

        expect(options.length).toBeGreaterThan(0);
        expect(options.every((plan) => plan.productDomain === ProductDomainEnum.TOURIST)).toBe(
            true
        );
        expect(options.some((plan) => plan.slug === 'tourist-vip')).toBe(false);
    });

    it('never offers an accommodation plan as a tourist destination', () => {
        const options = getChangePlanOptions({
            currentPlan: touristVip,
            currentSlug: 'tourist-vip',
            currentProductDomain: ProductDomainEnum.TOURIST
        });

        expect(options.some((plan) => plan.slug.startsWith('owner-'))).toBe(false);
    });

    it('falls back to the catalog plan when the row states no domain at all', () => {
        // A subscription predating the column. Not a disagreement — the plan's
        // own domain answers, so a legacy tourist row is not stranded.
        const options = getChangePlanOptions({
            currentPlan: touristVip,
            currentSlug: 'tourist-vip'
        });

        expect(options.length).toBeGreaterThan(0);
        expect(options.every((plan) => plan.productDomain === ProductDomainEnum.TOURIST)).toBe(
            true
        );
    });

    it('fails closed when the row and the catalog disagree', () => {
        // An un-migrated tourist row still claiming accommodation. This is why
        // T-039 is ordered after the T-038 backfill: acting on a stale reading
        // of what a subscription IS is the failure worth refusing.
        const options = getChangePlanOptions({
            currentPlan: touristVip,
            currentSlug: 'tourist-vip',
            currentProductDomain: ProductDomainEnum.ACCOMMODATION
        });

        expect(options).toEqual([]);
    });

    /**
     * The assertion above passes over `ALL_PLANS` whether or not the row/catalog
     * disagreement is checked at all — deleting that check still yields `[]`,
     * because today's catalog holds no plan matching the drifted domain AND the
     * tourist category. That mutation SURVIVED the first version of this suite.
     *
     * It is not a redundant check: without it, the row's domain is what drives
     * the destination filter, so a drifted row re-opens the HOS-331 trap from
     * the other side — it asks the catalog for that domain's plans and offers
     * them. Proving that needs a catalog where such a plan exists, which is
     * exactly what the injectable `plans` parameter is for.
     */
    it('does not let a drifted row choose the destination domain', () => {
        const touristLike: PlanDefinition = {
            ...fakePartnerGoldLikePlan,
            slug: 'tourist-vip',
            category: 'tourist',
            productDomain: ProductDomainEnum.TOURIST
        };
        // A partner plan filed under the tourist category — the same
        // category-is-not-the-discriminator shape `partner-gold` has.
        const partnerUnderTouristCategory: PlanDefinition = {
            ...fakePartnerGoldLikePlan,
            slug: 'partner-gold',
            category: 'tourist',
            productDomain: ProductDomainEnum.PARTNER
        };

        const options = getChangePlanOptions({
            currentPlan: touristLike,
            currentSlug: 'tourist-vip',
            // The row drifted to partner; the plan it is on says tourist.
            currentProductDomain: ProductDomainEnum.PARTNER,
            plans: [touristLike, partnerUnderTouristCategory]
        });

        expect(options).toEqual([]);
        expect(options.some((plan) => plan.slug === 'partner-gold')).toBe(false);
    });
});

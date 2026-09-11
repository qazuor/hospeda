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
import type { Subscription } from '../types';
import {
    buildGrantCompPayload,
    getChangePlanOptions,
    getPlanBySlug,
    getStatusLabel,
    getStatusVariant
} from '../utils';

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
    'comp',
    // HOS-1245: `courtesy` was missing here too — this list is what a
    // `Record<AdminSubscriptionViewStatus, ...>` compile error would have
    // forced once the schema widened, so it is worth keeping in lockstep with
    // `AdminSubscriptionViewStatusSchema` by hand rather than relying on `tsc`
    // alone to notice a drift.
    'courtesy'
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

    it('HOS-1245: gives courtesy a label distinct from comp (both would otherwise render "Cortesía")', () => {
        // `comp` (permanently complimentary, SPEC-262) and `courtesy` (a
        // finite gifted window, HOS-180) are different lifecycle states, but
        // the Spanish locale's existing `comp` label is literally "Cortesía" —
        // the Spanish word for "courtesy". Reusing the same word for the new
        // status would make two different badges read identically to an
        // operator. This asserts the i18n keys resolve to different strings
        // (using the real `t` would require loading the i18n package; here we
        // assert the KEYS differ, which is what the labels map controls).
        const compLabel = getStatusLabel('comp', (key) => key);
        const courtesyLabel = getStatusLabel('courtesy', (key) => key);
        expect(compLabel).not.toBe(courtesyLabel);
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

describe('buildGrantCompPayload (HOS-1314)', () => {
    /**
     * `customerId` (a `billing_customers.id`) and `user.id` (a Hospeda
     * `users.id`) are deliberately DIFFERENT uuids in this fixture — the same
     * pattern `admin-billing-view.service.test.ts` uses on the API side —
     * so a mix-up between the two fails loudly instead of passing by
     * coincidence.
     */
    const subscription: Subscription = {
        id: '11111111-1111-4111-8111-111111111111',
        customerId: '55555555-5555-4555-8555-555555555555',
        status: 'active',
        rawStatus: 'active',
        user: {
            id: '22222222-2222-4222-8222-222222222222',
            displayName: 'Julieta Ferreyra',
            email: 'julieta@local.test'
        },
        plan: null,
        recurringAmountInCents: null,
        billingInterval: 'month',
        currentPeriodStart: '2026-01-01T00:00:00.000Z',
        currentPeriodEnd: '2026-02-01T00:00:00.000Z',
        trialEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        productDomain: 'accommodation'
    };

    // HOS-1314 review: the mutation this test exists to catch is
    // `customerId: subscription.user?.id ?? ''` — the exact "billing
    // customer vs. login user" mix-up this whole feature was built to close.
    // That mutation stays GREEN against `not.toBe(subscription.user.id)`
    // alone if both ids happened to collide, so the payload's customerId is
    // also pinned to the LITERAL billing-customer uuid, not merely asserted
    // "different from something else".
    it('targets the billing customerId, never the Hospeda user id', () => {
        const payload = buildGrantCompPayload({
            subscription,
            planId: '33333333-3333-4333-8333-333333333333',
            interval: 'monthly'
        });

        expect(payload.customerId).toBe('55555555-5555-4555-8555-555555555555');
        expect(payload.customerId).not.toBe(subscription.user?.id);
    });

    it('passes the planId and interval through unchanged', () => {
        const payload = buildGrantCompPayload({
            subscription,
            planId: '33333333-3333-4333-8333-333333333333',
            interval: 'annual'
        });

        expect(payload).toEqual({
            customerId: '55555555-5555-4555-8555-555555555555',
            planId: '33333333-3333-4333-8333-333333333333',
            interval: 'annual'
        });
    });
});

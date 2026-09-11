/**
 * Every plan definition states its own product domain (HOS-1233 T-034 / AC-15g).
 *
 * `billing_plans.product_domain` is `NOT NULL` with a default, so a definition
 * that says nothing does not produce a plan without a domain — it produces one
 * filed under the default's vertical. That is precisely how the two tourist
 * plans came to claim `accommodation` in production and staging alike, with no
 * line of code being wrong.
 *
 * So these assertions read the VALUE on every definition, never merely that one
 * is present: "defined" is exactly what the column default already gave us, and
 * a presence check would pass against the bug itself.
 */
import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ALL_PLANS,
    COMPLEX_BASICO_PLAN,
    COMPLEX_PREMIUM_PLAN,
    COMPLEX_PRO_PLAN,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PREMIUM_PLAN,
    EXPERIENCE_PRO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PREMIUM_PLAN,
    GASTRONOMY_PRO_PLAN,
    OWNER_BASICO_PLAN,
    OWNER_PREMIUM_PLAN,
    OWNER_PRO_PLAN,
    PARTNER_GOLD_PLAN,
    PARTNER_LISTING_PLAN,
    PARTNER_SILVER_PLAN,
    TEST_DAILY_PLAN,
    TOURIST_FREE_PLAN,
    TOURIST_VIP_PLAN
} from '../src/config/plans.config.js';
import {
    EXPERIENCE_TRIAL_PLAN,
    GASTRONOMY_TRIAL_PLAN,
    OWNER_TRIAL_PLAN
} from '../src/config/trial-plans.config.js';
import type { PlanDefinition } from '../src/types/plan.types.js';

/** Every plan definition this package exports, not only the ones in ALL_PLANS. */
const EVERY_PLAN: readonly PlanDefinition[] = [
    OWNER_BASICO_PLAN,
    OWNER_PRO_PLAN,
    OWNER_PREMIUM_PLAN,
    COMPLEX_BASICO_PLAN,
    COMPLEX_PRO_PLAN,
    COMPLEX_PREMIUM_PLAN,
    TOURIST_FREE_PLAN,
    TOURIST_VIP_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PRO_PLAN,
    GASTRONOMY_PREMIUM_PLAN,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PRO_PLAN,
    EXPERIENCE_PREMIUM_PLAN,
    PARTNER_LISTING_PLAN,
    PARTNER_SILVER_PLAN,
    PARTNER_GOLD_PLAN,
    TEST_DAILY_PLAN,
    OWNER_TRIAL_PLAN,
    GASTRONOMY_TRIAL_PLAN,
    EXPERIENCE_TRIAL_PLAN
];

describe('PlanDefinition.productDomain (HOS-1233 AC-15g)', () => {
    it('every plan states a domain from the enum', () => {
        const known = new Set<string>(Object.values(ProductDomainEnum));

        for (const plan of EVERY_PLAN) {
            expect(known.has(plan.productDomain), `${plan.slug} → '${plan.productDomain}'`).toBe(
                true
            );
        }
    });

    it('no plan is filed as an add-on', () => {
        // `addon` tags an add-on's OWN preapproval row, never a plan. A plan
        // that claimed it would be invisible to every vertical at once.
        for (const plan of EVERY_PLAN) {
            expect(plan.productDomain, plan.slug).not.toBe(ProductDomainEnum.ADDON);
        }
    });

    it.each([
        [OWNER_BASICO_PLAN, ProductDomainEnum.ACCOMMODATION],
        [OWNER_PRO_PLAN, ProductDomainEnum.ACCOMMODATION],
        [OWNER_PREMIUM_PLAN, ProductDomainEnum.ACCOMMODATION],
        [COMPLEX_BASICO_PLAN, ProductDomainEnum.ACCOMMODATION],
        [COMPLEX_PRO_PLAN, ProductDomainEnum.ACCOMMODATION],
        [COMPLEX_PREMIUM_PLAN, ProductDomainEnum.ACCOMMODATION],
        [TEST_DAILY_PLAN, ProductDomainEnum.ACCOMMODATION],
        [TOURIST_FREE_PLAN, ProductDomainEnum.TOURIST],
        [TOURIST_VIP_PLAN, ProductDomainEnum.TOURIST],
        [GASTRONOMY_BASICO_PLAN, ProductDomainEnum.GASTRONOMY],
        [GASTRONOMY_PRO_PLAN, ProductDomainEnum.GASTRONOMY],
        [GASTRONOMY_PREMIUM_PLAN, ProductDomainEnum.GASTRONOMY],
        [EXPERIENCE_BASICO_PLAN, ProductDomainEnum.EXPERIENCE],
        [EXPERIENCE_PRO_PLAN, ProductDomainEnum.EXPERIENCE],
        [EXPERIENCE_PREMIUM_PLAN, ProductDomainEnum.EXPERIENCE],
        [PARTNER_LISTING_PLAN, ProductDomainEnum.PARTNER],
        [PARTNER_SILVER_PLAN, ProductDomainEnum.PARTNER],
        [PARTNER_GOLD_PLAN, ProductDomainEnum.PARTNER],
        [OWNER_TRIAL_PLAN, ProductDomainEnum.ACCOMMODATION],
        [GASTRONOMY_TRIAL_PLAN, ProductDomainEnum.GASTRONOMY],
        [EXPERIENCE_TRIAL_PLAN, ProductDomainEnum.EXPERIENCE]
    ])('$slug is filed under its own vertical', (plan, expected) => {
        expect(plan.productDomain).toBe(expected);
    });

    it('the tourist plans are NOT accommodation', () => {
        // The regression this whole spec exists for, stated on its own so it
        // cannot be lost among the table above.
        expect(TOURIST_FREE_PLAN.productDomain).toBe(ProductDomainEnum.TOURIST);
        expect(TOURIST_VIP_PLAN.productDomain).toBe(ProductDomainEnum.TOURIST);
        expect(ALL_PLANS.filter((p) => p.category === 'tourist')).toHaveLength(2);
        for (const plan of ALL_PLANS.filter((p) => p.category === 'tourist')) {
            expect(plan.productDomain, plan.slug).not.toBe(ProductDomainEnum.ACCOMMODATION);
        }
    });

    it('the domain is not a restatement of the category', () => {
        // Three plans carry `category: 'owner'` while holding three different
        // domains. Any future attempt to derive one from the other — the
        // obvious-looking simplification — breaks here rather than in
        // production.
        const ownerCategory = EVERY_PLAN.filter((p) => p.category === 'owner');
        const domains = new Set(ownerCategory.map((p) => p.productDomain));

        expect(domains.size).toBeGreaterThan(1);
        expect(domains).toContain(ProductDomainEnum.ACCOMMODATION);
        expect(domains).toContain(ProductDomainEnum.GASTRONOMY);
        expect(domains).toContain(ProductDomainEnum.PARTNER);
    });

    it('a commerce tier inherits the domain of the vertical it was built for', () => {
        // The factory derives, rather than each tier restating. Asserting all
        // three tiers of one vertical agree is what proves the derivation is
        // wired to `input.vertical` and not to something per-tier.
        const gastronomy = [GASTRONOMY_BASICO_PLAN, GASTRONOMY_PRO_PLAN, GASTRONOMY_PREMIUM_PLAN];
        const experience = [EXPERIENCE_BASICO_PLAN, EXPERIENCE_PRO_PLAN, EXPERIENCE_PREMIUM_PLAN];

        expect(new Set(gastronomy.map((p) => p.productDomain))).toEqual(
            new Set([ProductDomainEnum.GASTRONOMY])
        );
        expect(new Set(experience.map((p) => p.productDomain))).toEqual(
            new Set([ProductDomainEnum.EXPERIENCE])
        );
    });

    it('a trial plan inherits the domain of the plans it is composed of', () => {
        expect(GASTRONOMY_TRIAL_PLAN.productDomain).toBe(GASTRONOMY_PRO_PLAN.productDomain);
        expect(EXPERIENCE_TRIAL_PLAN.productDomain).toBe(EXPERIENCE_PRO_PLAN.productDomain);
        expect(OWNER_TRIAL_PLAN.productDomain).toBe(OWNER_PRO_PLAN.productDomain);
    });
});

/**
 * Which product domain a PLAN SLUG belongs to (HOS-1122).
 *
 * ---
 * WHY THIS FILE EXISTS
 *
 * Two services in `apps/api` take a plan — `applyDowngradeRestrictions` by slug,
 * `applyUpgradeRestorations` by id-then-slug — and act on the owner's
 * ACCOMMODATIONS and PROMOTIONS against that plan's caps. Until commerce had a
 * plan-change route (HOS-1119) nothing could hand either of them a plan from
 * another vertical. Now something can, and a commerce tier declares neither of
 * those caps: `commerceVerticalTier` gives a tier only its own vertical's
 * listing limit plus the tourist-VIP block.
 *
 * Neither service fails loudly on that. The restore direction resolved an
 * unknown slug to `{-1, -1, -1}` — *unlimited* — and un-restricted every
 * plan-restricted accommodation and promotion the owner had; the restrict
 * direction threw a `PlanCatalogMissError` the cron logs as "plan not in
 * catalog (non-blocking)", which reads like a data gap rather than a
 * cross-domain call. This is the read that lets both of them refuse instead.
 *
 * It is the same shape as {@link productDomainForLimitKey} one layer down
 * (HOS-1078), and for the same reason: **no default.** An unrecognised slug
 * returns `undefined` and the caller fails CLOSED. Substituting
 * `'accommodation'` at a call site is the `?? ACCOMMODATION` that file deleted,
 * one level up.
 *
 * ---
 * DERIVED FROM THE CATALOGUES, NEVER RESTATED
 *
 * The map is built at module load by walking {@link ALL_PLANS},
 * {@link COMMERCE_PLANS_BY_VERTICAL} and the three partner plans. Listing the
 * slugs here instead would be a second copy of a fact `plans.config.ts` already
 * holds — a seventh commerce tier or a fourth partner plan would be absent from
 * it, resolve to `undefined`, and be refused by a guard that was supposed to let
 * it through. Walking the catalogues means a plan added there is classified here
 * by construction.
 *
 * @module config/plan-domains
 */

import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import {
    type CommerceVertical,
    commerceVerticalToProductDomain
} from './commerce-limits.config.js';
import {
    ALL_PLANS,
    COMMERCE_PLANS_BY_VERTICAL,
    PARTNER_GOLD_PLAN,
    PARTNER_LISTING_PLAN,
    PARTNER_SILVER_PLAN
} from './plans.config.js';

/**
 * Every plan slug the platform knows, mapped to the `product_domain` its
 * subscription carries. Built once, from the catalogues themselves.
 */
function buildProductDomainByPlanSlug(): ReadonlyMap<string, ProductDomainValue> {
    const map = new Map<string, ProductDomainValue>();

    // `ALL_PLANS` is accommodation-only by construction — the owner tiers and
    // the tourist tiers, which ride on the accommodation subscription (see
    // `PRODUCT_DOMAIN_BY_LIMIT_KEY`'s tourist block for the same reasoning).
    for (const plan of ALL_PLANS) {
        map.set(plan.slug, ProductDomainEnum.ACCOMMODATION);
    }

    // One domain per commerce VERTICAL, never a single 'commerce' bucket
    // (SPEC-239 / HOS-692). The vertical→domain step goes through the existing
    // composed lookup rather than a ternary of its own (HOS-1079).
    for (const vertical of Object.keys(COMMERCE_PLANS_BY_VERTICAL) as CommerceVertical[]) {
        const domain = commerceVerticalToProductDomain(vertical);
        for (const plan of COMMERCE_PLANS_BY_VERTICAL[vertical]) {
            map.set(plan.slug, domain);
        }
    }

    for (const plan of [PARTNER_LISTING_PLAN, PARTNER_SILVER_PLAN, PARTNER_GOLD_PLAN]) {
        map.set(plan.slug, ProductDomainEnum.PARTNER);
    }

    return map;
}

const PRODUCT_DOMAIN_BY_PLAN_SLUG = buildProductDomainByPlanSlug();

/**
 * Resolves the product domain a plan slug belongs to.
 *
 * Returns `undefined` for a slug in no catalogue — a typo, a retired
 * `complex-*` tier (HOS-692 removed those from {@link ALL_PLANS}), or a row
 * seeded outside this file. Callers MUST fail closed on `undefined`: do not
 * restrict, do not restore, do not assume accommodation.
 *
 * @param planSlug - The `billing_plans.name` value (the catalogue slug).
 * @returns The owning product domain, or `undefined` when the slug is unknown.
 *
 * @example
 * ```ts
 * productDomainForPlanSlug('owner-pro');          // 'accommodation'
 * productDomainForPlanSlug('gastronomy-premium'); // 'gastronomy'
 * productDomainForPlanSlug('partner-gold');       // 'partner'
 * productDomainForPlanSlug('owner-prro');         // undefined
 * ```
 */
export function productDomainForPlanSlug(planSlug: string): ProductDomainValue | undefined {
    return PRODUCT_DOMAIN_BY_PLAN_SLUG.get(planSlug);
}

/**
 * Whether a plan slug names an ACCOMMODATION-domain plan.
 *
 * Deliberately NOT the fail-open posture `subscriptionMatchesDomain` takes for
 * a subscription row. That function reads a missing `product_domain` as
 * accommodation because the COLUMN post-dates most rows; a plan slug has no
 * such history — every plan the platform seeds is in one of the catalogues this
 * module walks, so an unknown slug means "not a plan we know", not "an old
 * accommodation plan". Answering `true` for it would restore or restrict an
 * owner's listings against caps nobody defined.
 *
 * @param planSlug - The catalogue slug to test.
 * @returns `true` only when the slug is a known accommodation-domain plan.
 */
export function isAccommodationPlanSlug(planSlug: string): boolean {
    return productDomainForPlanSlug(planSlug) === ProductDomainEnum.ACCOMMODATION;
}

/**
 * Resolves the commerce vertical a plan slug belongs to, or `undefined` when
 * the slug is not a commerce tier at all.
 *
 * The inverse of {@link commerceVerticalToProductDomain} for the two values
 * that have one, and the read the downgrade dispatcher uses to decide WHICH
 * vertical's listings a scheduled commerce downgrade is about.
 *
 * @param planSlug - The catalogue slug to classify.
 * @returns `'gastronomy'`, `'experience'`, or `undefined`.
 */
export function commerceVerticalForPlanSlug(planSlug: string): CommerceVertical | undefined {
    const domain = productDomainForPlanSlug(planSlug);
    if (domain === undefined) return undefined;
    for (const vertical of Object.keys(COMMERCE_PLANS_BY_VERTICAL) as CommerceVertical[]) {
        if (commerceVerticalToProductDomain(vertical) === domain) {
            return vertical;
        }
    }
    return undefined;
}

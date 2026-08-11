import { PartnerTierEnum } from '@repo/schemas';
import { PARTNER_GOLD_PLAN, PARTNER_SILVER_PLAN } from './plans.config.js';

/**
 * @file partner-tier-plans.config.ts
 * @description Which billing plan each partner tier is sold as (HOS-278 D4).
 *
 * Before this, `partners.tier` was a DISPLAY enum with no connection to
 * billing: an admin picked gold at provisioning time and nothing downstream
 * knew what gold cost. This map is that connection, and it is the only place
 * the two vocabularies meet — everything else should ask this rather than
 * hardcode a slug.
 */

/**
 * Tier → plan slug, or `null` for a tier that is not sold.
 *
 * ⚠️ **Every tier currently maps to a plan.** `BRONZE` was the only `null`
 * entry, and HOS-294 removed it from `PartnerTierEnum` (it had no plan, no
 * price and no product meaning). As a result `resolvePartnerTierPlanSlug` can
 * no longer return `null` and `isPartnerTierSellable` can no longer return
 * `false` — read that helper as documentation of an invariant, NOT as an active
 * guard protecting anything today.
 *
 * The `| null` in the type is kept on purpose rather than narrowed away: it
 * costs nothing, and it is what makes reintroducing a non-sellable tier a
 * one-line change here instead of a signature change that ripples outward. The
 * original rationale still holds for that case — an admin who provisions an
 * unsellable tier and then tries to charge for it should hit a refusal that
 * says "this tier has no plan" (`send-link` answers 422 on a missing `planId`)
 * rather than be silently billed for a tier they were not given.
 */
export const PARTNER_TIER_PLAN_SLUG: Readonly<Record<PartnerTierEnum, string | null>> = {
    [PartnerTierEnum.SILVER]: PARTNER_SILVER_PLAN.slug,
    [PartnerTierEnum.GOLD]: PARTNER_GOLD_PLAN.slug
};

/**
 * The plan slug a tier is sold as, or null when the tier carries no plan.
 *
 * @param input - `{ tier }` (RO-RO).
 * @returns The plan slug, or null for a tier with no commercial offering.
 */
export function resolvePartnerTierPlanSlug({
    tier
}: {
    readonly tier: PartnerTierEnum;
}): string | null {
    return PARTNER_TIER_PLAN_SLUG[tier] ?? null;
}

/**
 * Whether a tier can be charged for at all.
 *
 * Exists so call sites read as the question they are asking rather than as a
 * null check against a map they then have to explain.
 *
 * @param input - `{ tier }` (RO-RO).
 * @returns True when the tier has a plan behind it.
 */
export function isPartnerTierSellable({ tier }: { readonly tier: PartnerTierEnum }): boolean {
    return resolvePartnerTierPlanSlug({ tier }) !== null;
}

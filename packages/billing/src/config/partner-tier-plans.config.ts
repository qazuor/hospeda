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
 * **`BRONZE` maps to `null` deliberately.** §6.3 offers exactly two commercial
 * tiers, silver and gold; bronze exists in `PartnerTierEnum` as a display
 * value and has no price. Modelling that as `null` rather than quietly
 * defaulting to silver is the point: an admin who provisions a bronze partner
 * and then tries to charge them should hit a refusal that says "this tier has
 * no plan", not silently bill them for a tier they were not given. The refusal
 * already exists — `send-link` answers 422 when the partner has no `planId` —
 * so the null flows into a message someone can act on.
 */
export const PARTNER_TIER_PLAN_SLUG: Readonly<Record<PartnerTierEnum, string | null>> = {
    [PartnerTierEnum.BRONZE]: null,
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

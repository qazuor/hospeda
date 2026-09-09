/**
 * @file billing/pricing-audience-publish-vertical.ts
 * @description Where a pricing page's "Empezar" sends a visitor whose trial has
 * never started. HOS-1233 D-2 / AC-3.
 *
 * D-2's first branch is "step 1 of that vertical's create form", and step 1 is
 * the publish page (`PUBLISH_PAGE_PATH_BY_VERTICAL` — there is no separate
 * multi-step wizard). This module is the audience → vertical half of that
 * sentence, kept apart from `trial-start-branch.ts` because it answers a
 * different question: the canonical module decides WHICH branch, this one only
 * says where one of them points.
 *
 * @module lib/billing/pricing-audience-publish-vertical
 */

import type { PublishVerticalSlug } from '../api/endpoints-protected';
import type { PricingAudience } from '../billing-i18n';
import { PUBLISH_PAGE_PATH_BY_VERTICAL } from '../publish/publish-page-paths';

/**
 * The publish vertical each pricing audience creates a listing in, or `null`
 * when that audience creates none.
 *
 * **`tourist` is `null` and it is not an oversight.** A tourist tier owns no
 * listings at all — HOS-1233 is the spec that stopped filing those plans as
 * `accommodation`, precisely because they are not a listing vertical. There is
 * no form for a traveller to fill in, so there is no step 1 to send them to.
 *
 * `partner` is `null` for a different reason with the same consequence: a
 * partnership is agreed in a conversation (HOS-941 D-13), and that page's CTA
 * is a link rather than the purchase island, so this map is never consulted
 * for it.
 */
const PUBLISH_VERTICAL_BY_PRICING_AUDIENCE: Readonly<
    Record<PricingAudience, PublishVerticalSlug | null>
> = {
    owner: 'accommodation',
    tourist: null,
    gastronomy: 'gastronomy',
    experience: 'experience',
    partner: null
};

/**
 * The create-form path for a pricing audience, or `null` when it has none.
 *
 * @param input.audience - The audience the pricing grid was rendered for.
 * @returns A `buildUrl` path (no locale, no leading slash), or `null`.
 *
 * @example
 * ```ts
 * resolvePublishPathForPricingAudience({ audience: 'owner' }); // 'publicar'
 * resolvePublishPathForPricingAudience({ audience: 'tourist' }); // null
 * ```
 */
export function resolvePublishPathForPricingAudience({
    audience
}: {
    readonly audience: PricingAudience;
}): string | null {
    const vertical = PUBLISH_VERTICAL_BY_PRICING_AUDIENCE[audience];
    return vertical === null ? null : PUBLISH_PAGE_PATH_BY_VERTICAL[vertical];
}

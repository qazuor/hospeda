/**
 * @file addon-cap-offer.ts
 * @description Which add-on, if any, a host is offered when they hit the publishing cap of a
 * vertical (HOS-2632). Pure decisions over the catalog offers read from
 * `GET /protected/billing/addons/offers`: the compatible verticals and the granted limit keys
 * come from the DB catalog, never from a map in code. Names and prices are the catalog's.
 *
 * @module lib/billing/addon-cap-offer
 */

import type { AddonOffersResponse } from '@repo/schemas';
import { LimitKeyEnum } from '@repo/schemas';
import { purchasableOffers } from '@/lib/billing/addon-purchase';

/** The verticals reachable from the header's "Publicar" menu. */
export type CapVertical = 'accommodation' | 'venue' | 'experience';

/** One catalog offer, as the offers endpoint returns it. */
export type CapAddonCatalogOffer = AddonOffersResponse['items'][number];

/** The slice of an offer the cap panel and the publish error need to render it. */
export interface CapAddonOffer {
    readonly slug: string;
    /** Catalog name: the fallback when a locale has no copy for the slug. */
    readonly name: string;
    /** Price in centavos, as the catalog stores it. */
    readonly price: number;
    readonly currency: string;
}

/** i18n key of the add-on action label, shared by the precheck panel and the publish error. */
export const CAP_ADDON_CTA_KEY = 'publish.capAddon.cta';

/** The publishing-cap limit key of each vertical. */
export const PUBLISH_CAP_LIMIT_KEY: Readonly<Record<CapVertical, string>> = {
    accommodation: LimitKeyEnum.MAX_ACCOMMODATIONS,
    venue: LimitKeyEnum.MAX_VENUES,
    experience: LimitKeyEnum.MAX_EXPERIENCES
};

/**
 * Picks the add-on offered at the publishing cap of a vertical: a saleable catalog offer that is
 * compatible with the vertical AND grants that vertical's cap limit key. When several qualify the
 * cheapest leads (ties by slug, so the answer is stable). `null` when none exists: the caller
 * then offers the plan change alone.
 *
 * @param input.offers - The catalog offers (`billingAddonApi.offers()` items).
 * @param input.vertical - The vertical whose cap was hit.
 * @returns The add-on to offer, or `null`.
 */
export function findCapAddonOffer(input: {
    readonly offers: readonly CapAddonCatalogOffer[];
    readonly vertical: CapVertical;
}): CapAddonOffer | null {
    const { offers, vertical } = input;
    const limitKey = PUBLISH_CAP_LIMIT_KEY[vertical];
    const [best] = purchasableOffers(offers)
        .filter(
            (offer) =>
                offer.compatibleVerticals.includes(vertical) && offer.grantedKeys.includes(limitKey)
        )
        .sort((a, b) => a.price - b.price || a.slug.localeCompare(b.slug));
    return best
        ? { slug: best.slug, name: best.name, price: best.price, currency: best.currency }
        : null;
}

/**
 * Where the cap add-on is bought: the add-ons section of the vertical's subscription page
 * (HOS-2627 moved add-on purchase there).
 *
 * @param input.subscriptionUrl - The vertical's subscription page URL.
 * @param input.vertical - The vertical.
 * @returns The URL with the section anchor.
 */
export function capAddonHref(input: {
    readonly subscriptionUrl: string;
    readonly vertical: CapVertical;
}): string {
    return `${input.subscriptionUrl}#addons-${input.vertical}`;
}

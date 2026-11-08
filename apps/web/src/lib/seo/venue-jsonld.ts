/**
 * @file venue-jsonld.ts
 * @description Pure builder for a venue listing's schema.org structured data
 * (HOS-1787 leaf 6.1, F-V1-040).
 *
 * The `@type` is derived from the venue's own `type`, never from a business
 * line (G-FAC-03): the type is descriptive, so it can select the schema.org
 * subtype without re-deriving visibility. The mapping is an exhaustive
 * `Record<VenueTypeEnum, …>`, so a type added to the enum stops the build
 * until its schema.org counterpart is declared — the same contract
 * `VENUE_TYPE_ICONS` uses.
 *
 * `hasMenu` is NOT a decision made here either. The caller passes the value
 * `buildRestaurantHasMenu` already derived from the PUBLIC payload; this
 * builder only omits the key when there is no value, so a BOLICHE's
 * `NightClub` object never carries a `hasMenu` the API withheld (AC:6:5).
 */

import { VenueTypeEnum } from '@repo/schemas';

/** The schema.org subtype a venue listing can advertise. */
export type VenueSchemaOrgType =
    | 'Restaurant'
    | 'BarOrPub'
    | 'NightClub'
    | 'CafeOrCoffeeShop'
    | 'IceCreamShop'
    | 'Bakery';

/**
 * Venue type → schema.org `@type`.
 *
 * `RESTAURANT`, `PARRILLA`, `ROTISERIA` and `FOOD_TRUCK` all fall to plain
 * `Restaurant`: schema.org has no dedicated subtype that is more truthful for
 * them, and `Restaurant` is the generic `FoodEstablishment` result the spec
 * asks for as "el resto".
 */
export const VENUE_SCHEMA_ORG_TYPE: Readonly<Record<VenueTypeEnum, VenueSchemaOrgType>> = {
    [VenueTypeEnum.RESTAURANT]: 'Restaurant',
    [VenueTypeEnum.BAR]: 'BarOrPub',
    [VenueTypeEnum.CAFE]: 'CafeOrCoffeeShop',
    [VenueTypeEnum.PARRILLA]: 'Restaurant',
    [VenueTypeEnum.CERVECERIA]: 'BarOrPub',
    [VenueTypeEnum.HELADERIA]: 'IceCreamShop',
    [VenueTypeEnum.PANADERIA]: 'Bakery',
    [VenueTypeEnum.ROTISERIA]: 'Restaurant',
    [VenueTypeEnum.FOOD_TRUCK]: 'Restaurant',
    [VenueTypeEnum.PUB]: 'BarOrPub',
    [VenueTypeEnum.BOLICHE]: 'NightClub'
};

/** schema.org `AggregateRating` payload, as the venue JSON-LD expects it. */
export interface VenueAggregateRating {
    readonly ratingValue: number;
    readonly reviewCount: number;
    readonly bestRating?: number;
    readonly worstRating?: number;
}

/** Inputs the detail page already has when it mounts the component. */
export interface BuildVenueStructuredDataInput {
    readonly name: string;
    readonly description: string;
    readonly url: string;
    /** Venue type from the API (`VenueCardData.type`), a plain string. */
    readonly type: string;
    readonly image?: string;
    readonly priceRange?: string;
    readonly servesCuisine?: string;
    readonly telephone?: string;
    readonly hasMenu?: string;
    /** Accepted payment methods as human labels (HOS-2060, `policies.paymentMethods`). */
    readonly paymentAccepted?: string;
    readonly aggregateRating?: VenueAggregateRating;
}

/**
 * Resolve the schema.org `@type` for a venue type.
 *
 * `type` arrives as a plain `string` because that is the shape of
 * `VenueCardData.type`. A value outside the enum is "el resto" and resolves to
 * `Restaurant` — the fallback is a single lookup default, not a per-type
 * comparison.
 *
 * @param params.type - Venue type from the public payload.
 * @returns The schema.org subtype, `Restaurant` for an unknown value.
 */
export function resolveVenueSchemaType({ type }: { readonly type: string }): VenueSchemaOrgType {
    return VENUE_SCHEMA_ORG_TYPE[type as VenueTypeEnum] ?? 'Restaurant';
}

/**
 * Assemble the schema.org object for a venue detail page.
 *
 * The optional keys are added only when the caller supplied a truthy value,
 * which is what makes `hasMenu` absent (not `null`, not `''`) for a venue
 * whose `menu` section is not `available`.
 *
 * @param input - The venue fields the public page has at hand.
 * @returns The object `JsonLd.astro` serializes.
 */
export function buildVenueStructuredData({
    name,
    description,
    url,
    type,
    image,
    priceRange,
    servesCuisine,
    telephone,
    hasMenu,
    paymentAccepted,
    aggregateRating
}: BuildVenueStructuredDataInput): Record<string, unknown> {
    const structuredData: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': resolveVenueSchemaType({ type }),
        name,
        description,
        url
    };

    if (image) {
        structuredData.image = image;
    }

    if (priceRange) {
        structuredData.priceRange = priceRange;
    }

    if (servesCuisine) {
        structuredData.servesCuisine = servesCuisine;
    }

    if (telephone) {
        structuredData.telephone = telephone;
    }

    if (hasMenu) {
        structuredData.hasMenu = hasMenu;
    }

    if (paymentAccepted) {
        structuredData.paymentAccepted = paymentAccepted;
    }

    if (aggregateRating) {
        structuredData.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: aggregateRating.ratingValue,
            reviewCount: aggregateRating.reviewCount,
            bestRating: aggregateRating.bestRating ?? 5,
            worstRating: aggregateRating.worstRating ?? 1
        };
    }

    return structuredData;
}

/**
 * @file get-listing-context.ts
 * @description The "where is it and what does it offer" half of `get_listing`
 * (HOS-2377): the listing's address, its destination by name and its amenities
 * and features as Spanish display names, so the assistant can answer
 * "¿dónde queda?" and "¿qué comodidades tiene?" without a second call.
 *
 * - **Owner-only.** It runs on a row `get_listing` already admitted through
 *   the get-own gate (`READ_OWN`, no staff bypass), so the owner's own address
 *   is returned and a foreign listing never reaches this module.
 * - **Names, not detail.** Labels come from `@repo/i18n` keyed by slug
 *   (SPEC-266: no `name` column). The list is capped at
 *   {@link GET_LISTING_MAX_CATALOG_NAMES} per kind; the full catalog, grouped
 *   and with selection state, stays in `get_listing_amenities`.
 */

import { DestinationService } from '@repo/service-core';
import { amenityLabel, featureLabel } from '../../../services/ai-context/listing-labels';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import type { ListingCatalogRef } from './get-listing';

/** Most amenity (and, separately, feature) names `get_listing` returns. */
export const GET_LISTING_MAX_CATALOG_NAMES = 30;

/** Locale of the display names: the platform default (tool replies are Spanish). */
const NAMES_LOCALE = 'es';

/** Capped, name-only catalog summary of one kind. */
export interface CatalogNameSummary {
    /** Display names, at most {@link GET_LISTING_MAX_CATALOG_NAMES}. */
    readonly names: readonly string[];
    /** How many the listing has in total. */
    readonly total: number;
}

/** Location and catalog summary added to the `get_listing` result. */
export interface ListingContext {
    /** Street address as one line, or the experience meeting point; `null` when none. */
    readonly address: string | null;
    /** Destination (city) name; `null` when it could not be read. */
    readonly destination: string | null;
    /** Amenity display names. */
    readonly amenityNames: CatalogNameSummary;
    /** Feature display names. */
    readonly featureNames: CatalogNameSummary;
    /** Present when a list was capped: where to read the rest. */
    readonly moreInfo?: string;
}

const destinationService = new DestinationService({ logger: apiLogger });

/** The stored fields the address is built from, across verticals. */
interface AddressSource {
    readonly location?: {
        readonly street?: string | null;
        readonly number?: string | null;
        readonly floor?: string | null;
        readonly apartment?: string | null;
    } | null;
    readonly meetingPoint?: string | null;
}

/**
 * Formats the address of a row: `Calle 123, piso 2, depto B` for an
 * accommodation or venue, the meeting point for an experience.
 *
 * @param args.row - The owned row
 * @returns One line, or `null` when the row has no address
 */
export function formatListingAddress({ row }: { readonly row: AddressSource }): string | null {
    const meetingPoint = row.meetingPoint?.trim();
    if (meetingPoint) {
        return meetingPoint;
    }
    const { street, number, floor, apartment } = row.location ?? {};
    const streetLine = [street, number]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');
    const parts = [
        streetLine,
        floor?.trim() ? `piso ${floor.trim()}` : '',
        apartment?.trim() ? `depto ${apartment.trim()}` : ''
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
}

/** Display names of the refs, capped; refs without a slug are skipped. */
function summarize({
    refs,
    labelOf
}: {
    readonly refs: readonly ListingCatalogRef[];
    readonly labelOf: (slug: string) => string;
}): CatalogNameSummary {
    const names = refs
        .map((ref) => (ref.slug ? labelOf(ref.slug) : ''))
        .filter((name) => name.length > 0);
    return { names: names.slice(0, GET_LISTING_MAX_CATALOG_NAMES), total: names.length };
}

/** Reads the destination name as the guest; `null` when it cannot be read. */
async function readDestinationName({
    destinationId
}: {
    readonly destinationId: string | null | undefined;
}): Promise<string | null> {
    if (!destinationId) {
        return null;
    }
    const result = await destinationService.getById(createGuestActor(), destinationId);
    return result.error || !result.data ? null : result.data.name;
}

/**
 * Builds the location and catalog summary of an owned listing.
 *
 * @param args.row - The owned row, already admitted by the get-own gate
 * @param args.amenities - The listing's amenity refs
 * @param args.features - The listing's feature refs
 * @returns The context to merge into the `get_listing` result
 */
export async function buildListingContext(args: {
    readonly row: AddressSource & { readonly destinationId?: string | null };
    readonly amenities: readonly ListingCatalogRef[];
    readonly features: readonly ListingCatalogRef[];
}): Promise<ListingContext> {
    const { row, amenities, features } = args;
    const amenityNames = summarize({
        refs: amenities,
        labelOf: (slug) => amenityLabel({ slug, locale: NAMES_LOCALE }).label
    });
    const featureNames = summarize({
        refs: features,
        labelOf: (slug) => featureLabel({ slug, locale: NAMES_LOCALE }).label
    });
    const capped =
        amenityNames.total > amenityNames.names.length ||
        featureNames.total > featureNames.names.length;
    return {
        address: formatListingAddress({ row }),
        destination: await readDestinationName({ destinationId: row.destinationId }),
        amenityNames,
        featureNames,
        ...(capped
            ? { moreInfo: 'Some names were left out. Use get_listing_amenities for the full list.' }
            : {})
    };
}

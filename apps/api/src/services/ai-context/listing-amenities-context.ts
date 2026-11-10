/**
 * Amenities block of the VENUE and EXPERIENCE chat contexts (HOS-2100).
 *
 * The accommodation assembler has always listed its amenities; the venue and
 * experience assemblers never read `r_venue_amenity` / `r_experience_amenity`,
 * so the assistant answered «¿tiene estacionamiento?» on those verticals with
 * "the listing does not say" even when the owner had ticked it. Amenities are
 * public listing data (the public detail routes return them ungated), so no
 * section/entitlement check applies here.
 *
 * Rendering mirrors the accommodation block: the catalog's own curation decides
 * what survives a cap (featured first, then higher `displayWeight`), and each
 * slug renders as its localized label, never as the raw slug.
 *
 * Each line also carries the attributes the OWNER declared on the relation
 * (HOS-2061/HOS-2084, migration 0195), compactly: «con cargo extra», «privado» /
 * «compartido», «todo el año» / «de temporada». Without them «¿el
 * estacionamiento está incluido?» could become «sí» for a paid one. A NULL
 * attribute is not declared and renders nothing (never inferred). Only active,
 * non-deleted catalog amenities are read.
 *
 * @module apps/api/services/ai-context/listing-amenities-context
 */

import { amenities, getDb, rExperienceAmenity, rVenueAmenity } from '@repo/db';
import type { Locale } from '@repo/i18n';
import { and, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import { amenityLabel } from './listing-labels.js';

/** Maximum amenities rendered in a venue/experience context block. */
export const LISTING_CONTEXT_AMENITY_MAX = 60;

/**
 * Row ceiling for the amenity read. Higher than the render cap so the
 * prioritization runs over the whole set rather than an arbitrary DB slice.
 */
const LISTING_AMENITY_FETCH_MAX = 300;

/** Default catalog display weight (the column default). */
const DEFAULT_DISPLAY_WEIGHT = 50;

/** One amenity as the context block consumes it. */
export interface ListingContextAmenity {
    /** Catalog slug; resolved to its localized label when rendered. */
    readonly slug: string;
    /** Catalog curation flag; featured amenities are listed first. */
    readonly isFeatured?: boolean;
    /** Catalog display weight; higher is listed first. */
    readonly displayWeight?: number;
    /** Owner-declared «paid separately» (`is_optional`, or any additional cost). */
    readonly extraCharge?: boolean;
    /** Owner-declared scope; `null`/absent = not declared. */
    readonly scope?: 'private' | 'shared' | null;
    /** Owner-declared availability; `null`/absent = not declared. */
    readonly availability?: 'year_round' | 'seasonal' | null;
}

/** Labels of the owner-declared attributes (the context is written in Spanish). */
const SCOPE_LABEL = { private: 'privado', shared: 'compartido' } as const;
const AVAILABILITY_LABEL = { year_round: 'todo el año', seasonal: 'de temporada' } as const;

/** The parenthesized attribute suffix of one amenity line, or `''`. */
function attributeSuffix(row: ListingContextAmenity): string {
    const parts: string[] = [];
    if (row.extraCharge) parts.push('con cargo extra');
    if (row.scope) parts.push(SCOPE_LABEL[row.scope]);
    if (row.availability) parts.push(AVAILABILITY_LABEL[row.availability]);
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

/** The two verticals whose amenities this module loads. */
export type AmenityListingVertical = 'venue' | 'experience';

/**
 * Orders amenities by the catalog curation (featured first, then higher
 * `displayWeight`), keeping the input order among ties.
 */
function prioritize(
    rows: ReadonlyArray<ListingContextAmenity>
): ReadonlyArray<ListingContextAmenity> {
    return rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
            const featured = Number(b.row.isFeatured ?? false) - Number(a.row.isFeatured ?? false);
            if (featured !== 0) return featured;
            const weight =
                (b.row.displayWeight ?? DEFAULT_DISPLAY_WEIGHT) -
                (a.row.displayWeight ?? DEFAULT_DISPLAY_WEIGHT);
            return weight === 0 ? a.index - b.index : weight;
        })
        .map(({ row }) => row);
}

/**
 * Builds the `### Comodidades` block. PURE — no I/O.
 *
 * @param input.amenities - The listing's amenities, in any order.
 * @param input.locale - Page locale for the labels.
 * @returns `{ lines }`: empty when the listing has no amenity, otherwise a blank
 *   separator, the heading and one `- label` line per amenity (capped at
 *   {@link LISTING_CONTEXT_AMENITY_MAX}).
 */
export function buildListingAmenityLines({
    amenities: rows,
    locale
}: {
    readonly amenities: ReadonlyArray<ListingContextAmenity>;
    readonly locale: Locale;
}): { readonly lines: readonly string[] } {
    const usable = rows.filter((row) => row.slug.trim().length > 0);
    if (usable.length === 0) return { lines: [] };
    const capped = prioritize(usable).slice(0, LISTING_CONTEXT_AMENITY_MAX);
    return {
        lines: [
            '',
            '### Comodidades',
            ...capped.map(
                (row) =>
                    `- ${amenityLabel({ slug: row.slug, locale }).label}${attributeSuffix(row)}`
            )
        ]
    };
}

/**
 * Loads a venue's or an experience's amenities with their curation columns.
 *
 * Returns `[]` on any error, with a logged warning: a chat request must not fail
 * because one relation is unavailable (same contract as the FAQ and carta reads).
 *
 * @param input.vertical - Which junction table to read.
 * @param input.listingId - The venue or experience id.
 * @returns The amenities, unordered.
 */
export async function safeLoadListingAmenities({
    vertical,
    listingId
}: {
    readonly vertical: AmenityListingVertical;
    readonly listingId: string;
}): Promise<ListingContextAmenity[]> {
    try {
        const db = getDb();
        // Soft-deleted or non-active catalog amenities never reach the visitor.
        const activeCatalog = and(
            isNull(amenities.deletedAt),
            eq(amenities.lifecycleState, 'ACTIVE')
        );
        // Exhaustive switch, not a binary ternary (HOS-1079, guard G1(b)): a third
        // vertical must be a compile error, never a silent read of the wrong table.
        const rows = await (async () => {
            switch (vertical) {
                case 'venue':
                    return db
                        .select({
                            slug: amenities.slug,
                            isFeatured: amenities.isFeatured,
                            displayWeight: amenities.displayWeight,
                            isOptional: rVenueAmenity.isOptional,
                            additionalCost: rVenueAmenity.additionalCost,
                            additionalCostPercent: rVenueAmenity.additionalCostPercent,
                            scope: rVenueAmenity.scope,
                            availability: rVenueAmenity.availability
                        })
                        .from(rVenueAmenity)
                        .innerJoin(amenities, eq(rVenueAmenity.amenityId, amenities.id))
                        .where(and(eq(rVenueAmenity.venueId, listingId), activeCatalog))
                        .limit(LISTING_AMENITY_FETCH_MAX);
                case 'experience':
                    return db
                        .select({
                            slug: amenities.slug,
                            isFeatured: amenities.isFeatured,
                            displayWeight: amenities.displayWeight,
                            isOptional: rExperienceAmenity.isOptional,
                            additionalCost: rExperienceAmenity.additionalCost,
                            additionalCostPercent: rExperienceAmenity.additionalCostPercent,
                            scope: rExperienceAmenity.scope,
                            availability: rExperienceAmenity.availability
                        })
                        .from(rExperienceAmenity)
                        .innerJoin(amenities, eq(rExperienceAmenity.amenityId, amenities.id))
                        .where(and(eq(rExperienceAmenity.experienceId, listingId), activeCatalog))
                        .limit(LISTING_AMENITY_FETCH_MAX);
                default: {
                    const exhaustive: never = vertical;
                    throw new Error(`Unsupported amenity vertical: ${String(exhaustive)}`);
                }
            }
        })();
        return rows.map((row) => ({
            slug: row.slug ?? '',
            isFeatured: row.isFeatured ?? false,
            displayWeight: row.displayWeight ?? DEFAULT_DISPLAY_WEIGHT,
            extraCharge:
                row.isOptional === true ||
                row.additionalCost != null ||
                row.additionalCostPercent != null,
            scope: row.scope === 'private' || row.scope === 'shared' ? row.scope : null,
            availability:
                row.availability === 'year_round' || row.availability === 'seasonal'
                    ? row.availability
                    : null
        }));
    } catch (error) {
        apiLogger.warn(
            {
                vertical,
                listingId,
                error: error instanceof Error ? error.message : String(error)
            },
            'listing-amenities-context: failed to load amenities; continuing with empty list'
        );
        return [];
    }
}

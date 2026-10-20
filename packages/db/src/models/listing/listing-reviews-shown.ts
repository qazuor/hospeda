import { PublicationStatusEnum } from '@repo/schemas';
import { and, type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { accommodationReviews } from '../../schemas/accommodation/accommodation_review.dbschema.ts';
import { experienceReviews } from '../../schemas/experience/experience_review.dbschema.ts';
import { experiences } from '../../schemas/experience/experiences.dbschema.ts';
import { gastronomies } from '../../schemas/gastronomy/gastronomy.dbschema.ts';
import { gastronomyReviews } from '../../schemas/gastronomy/gastronomy_review.dbschema.ts';
import type { ListingVertical } from './listing-publication.model.ts';

const TABLES: Record<
    ListingVertical,
    {
        readonly listing: PgTable;
        readonly reviewListingId: AnyPgColumn;
    }
> = {
    accommodation: {
        listing: accommodations,
        reviewListingId: accommodationReviews.accommodationId
    },
    gastronomy: {
        listing: gastronomies,
        reviewListingId: gastronomyReviews.gastronomyId
    },
    experience: {
        listing: experiences,
        reviewListingId: experienceReviews.experienceId
    }
};

/**
 * SQL twin of service-core's `listingShowsReviews`: public review readers hide
 * reviews only when their listing is PURGED, while preserving the review row
 * (AC:V9b:3, AC:1686:1, G1-5).
 */
export function listingReviewsShownCondition(input: { readonly vertical: ListingVertical }): SQL {
    const { listing, reviewListingId } = TABLES[input.vertical];
    return sql`NOT EXISTS (
        SELECT 1 FROM ${listing} AS "purged_listing"
        WHERE ${and(
            sql`"purged_listing"."id" = ${reviewListingId}`,
            sql`"purged_listing"."publication_status" = ${PublicationStatusEnum.PURGED}`
        )}
    )`;
}

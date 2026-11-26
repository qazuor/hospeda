import { accommodations } from '@repo/db';
import type { DynamicBlockConfig } from '@repo/schemas';
import { NewsletterDynamicSourceEnum, PublicationStatusEnum } from '@repo/schemas';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';

/** Canonical eligibility for both candidate queries and send-time revalidation. */
export function eligibleAccommodationPredicate(input: { readonly block: DynamicBlockConfig }) {
    const { block } = input;
    return sql<boolean>`${and(
        isNull(accommodations.deletedAt),
        eq(accommodations.publicationStatus, PublicationStatusEnum.PUBLISHED),
        block.params.destinationId
            ? eq(accommodations.destinationId, block.params.destinationId)
            : undefined,
        block.source === NewsletterDynamicSourceEnum.TOP_RATED
            ? gte(accommodations.reviewsCount, block.params.minReviews ?? 3)
            : undefined
    )}`;
}

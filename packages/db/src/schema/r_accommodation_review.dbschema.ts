import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema';
import { accommodationReviews } from './accommodation_review.dbschema';

/**
 * r_accommodation_review join table
 * Composite PK on (accommodation_id, review_id)
 */
export const accommodationReviewRelations: ReturnType<typeof pgTable> = pgTable(
    'r_accommodation_review',
    {
        /** FK to accommodations.id */
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),

        /** FK to accommodation_reviews.id */
        reviewId: uuid('review_id')
            .notNull()
            .references(() => accommodationReviews.id, { onDelete: 'cascade' })
    },
    (table) => ({
        /** Composite primary key to prevent duplicate mappings */
        pk: primaryKey({ columns: [table.accommodationId, table.reviewId] })
    })
);

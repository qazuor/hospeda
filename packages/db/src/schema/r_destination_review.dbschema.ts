import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { destinations } from './destination.dbschema';
import { destinationReviews } from './destination_review.dbschema';

/**
 * r_destination_review join table
 * Composite PK on (destination_id, review_id)
 */
export const destinationReviewRelations: ReturnType<typeof pgTable> = pgTable(
    'r_destination_review',
    {
        /** FK to destinations.id */
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'cascade' }),

        /** FK to destination_reviews.id */
        reviewId: uuid('review_id')
            .notNull()
            .references(() => destinationReviews.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.destinationId, table.reviewId] })
    })
);

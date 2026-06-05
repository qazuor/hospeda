import type { DestinationRatingInput } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum, ModerationStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { destinations } from './destination.dbschema.ts';

export const destinationReviews = pgTable(
    'destination_reviews',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'set null' }),
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'cascade' }),
        title: text('title'),
        content: text('content'),
        rating: jsonb('rating').$type<DestinationRatingInput>().notNull(),
        /** Computed average of all rating categories (0.00-5.00). Drizzle mode:'number' ensures runtime JS number type. */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
            .notNull()
            .default(0),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        /**
         * Moderation state for the review. Defaults to PENDING because destination
         * reviews must be approved before becoming publicly visible (spec §3.1).
         */
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        /** User who performed the last moderation action. Nullable (no action yet). */
        moderatedById: uuid('moderated_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** Timestamp of the last moderation action. Nullable until first moderation. */
        moderatedAt: timestamp('moderated_at', { withTimezone: true }),
        /** Free-text reason for the moderation decision. Nullable. */
        moderationReason: text('moderation_reason')
    },
    (table) => ({
        destination_reviews_destinationId_idx: index('destination_reviews_destinationId_idx').on(
            table.destinationId
        ),
        destination_reviews_userId_idx: index('destination_reviews_userId_idx').on(table.userId),
        destinationReviews_lifecycleState_idx: index('destinationReviews_lifecycleState_idx').on(
            table.lifecycleState
        ),
        // SPEC-063-gaps T-013 (GAP-024): composite for the dominant listByDestination
        // query (destinationId + lifecycleState filter after T-003).
        destination_reviews_destinationId_lifecycleState_idx: index(
            'destination_reviews_destinationId_lifecycleState_idx'
        ).on(table.destinationId, table.lifecycleState),
        // SPEC-166: moderation state index for admin moderation queue queries.
        destination_reviews_moderationState_idx: index(
            'destination_reviews_moderationState_idx'
        ).on(table.moderationState)
    })
);

export const destinationReviewsRelations = relations(destinationReviews, ({ one }) => ({
    destination: one(destinations, {
        fields: [destinationReviews.destinationId],
        references: [destinations.id]
    }),
    user: one(users, {
        fields: [destinationReviews.userId],
        references: [users.id]
    }),
    moderatedBy: one(users, {
        fields: [destinationReviews.moderatedById],
        references: [users.id],
        relationName: 'destinationReviewModerator'
    })
}));

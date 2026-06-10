import type { AccommodationRatingInput, AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import {
    index,
    jsonb,
    numeric,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum, ModerationStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodations } from './accommodation.dbschema.ts';

export const accommodationReviews = pgTable(
    'accommodation_reviews',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'set null' }),
        title: text('title'),
        content: text('content'),
        rating: jsonb('rating').$type<AccommodationRatingInput>().notNull(),
        /** Computed average of all rating categories (0.00-5.00). Drizzle mode:'number' ensures runtime JS number type. */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
            .notNull()
            .default(0),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        /**
         * Moderation state for the review. Defaults to APPROVED because accommodation
         * reviews publish immediately (spec §3.1: no moderation gate for accommodations).
         */
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('APPROVED'),
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
        accommodation_reviews_accommodationId_idx: index(
            'accommodation_reviews_accommodationId_idx'
        ).on(table.accommodationId),
        accommodation_reviews_userId_idx: index('accommodation_reviews_userId_idx').on(
            table.userId
        ),
        accommodation_reviews_user_accommodation_uniq: uniqueIndex(
            'accommodation_reviews_user_accommodation_uniq'
        ).on(table.userId, table.accommodationId),
        // SPEC-063-gaps T-011 (GAP-018): single-column lifecycleState index for parity
        // with peer entities (Sponsorship, OwnerPromotion, DestinationReview).
        accommodation_reviews_lifecycleState_idx: index(
            'accommodation_reviews_lifecycleState_idx'
        ).on(table.lifecycleState),
        // SPEC-063-gaps T-012 (GAP-023): composite supports the dominant
        // listByAccommodation query (accommodationId + lifecycleState filter after
        // T-002).
        accommodation_reviews_accommodationId_lifecycleState_idx: index(
            'accommodation_reviews_accommodationId_lifecycleState_idx'
        ).on(table.accommodationId, table.lifecycleState),
        // SPEC-166: moderation state index for admin moderation queue queries.
        accommodation_reviews_moderationState_idx: index(
            'accommodation_reviews_moderationState_idx'
        ).on(table.moderationState)
    })
);

export const accommodationReviewsRelations = relations(accommodationReviews, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationReviews.accommodationId],
        references: [accommodations.id]
    }),
    user: one(users, {
        fields: [accommodationReviews.userId],
        references: [users.id]
    }),
    moderatedBy: one(users, {
        fields: [accommodationReviews.moderatedById],
        references: [users.id],
        relationName: 'accommodationReviewModerator'
    })
}));

import type { AdminInfoType } from '@repo/schemas';
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
import { gastronomies } from './gastronomy.dbschema.ts';

/**
 * Gastronomy review table (SPEC-239).
 *
 * Mirrors accommodation_reviews exactly:
 * - FK gastronomyId CASCADE (if the listing is deleted, reviews go with it)
 * - FK userId SET NULL (review stays when reviewer is deleted)
 * - Granular rating breakdown via jsonb
 * - averageRating / lifecycleState / moderationState
 * - Full moderation audit (moderatedById / moderatedAt / moderationReason)
 * - UNIQUE(userId, gastronomyId) — one review per user per listing
 */
export const gastronomyReviews = pgTable(
    'gastronomy_reviews',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'set null' }),
        title: text('title'),
        content: text('content'),
        /** Granular rating breakdown (food/service/ambiance/value). */
        rating: jsonb('rating').$type<Record<string, unknown>>().notNull(),
        /** Computed average of all rating categories (0.00–5.00). mode:'number' for JS coercion. */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
            .notNull()
            .default(0),
        /** Overall aggregated rating score (0.00–5.00). mode:'number' for JS coercion. */
        overallRating: numeric('overall_rating', { precision: 3, scale: 2, mode: 'number' })
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
         * Moderation state defaults to PENDING: gastronomy reviews require
         * moderator approval before appearing publicly (unlike accommodation
         * reviews which default to APPROVED).
         */
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        /** User who performed the last moderation action. */
        moderatedById: uuid('moderated_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** Timestamp of the last moderation action. */
        moderatedAt: timestamp('moderated_at', { withTimezone: true }),
        /** Free-text reason for the moderation decision. */
        moderationReason: text('moderation_reason')
    },
    (table) => ({
        gastronomy_reviews_gastronomyId_idx: index('gastronomy_reviews_gastronomyId_idx').on(
            table.gastronomyId
        ),
        gastronomy_reviews_userId_idx: index('gastronomy_reviews_userId_idx').on(table.userId),
        gastronomy_reviews_user_gastronomy_uniq: uniqueIndex(
            'gastronomy_reviews_user_gastronomy_uniq'
        ).on(table.userId, table.gastronomyId),
        gastronomy_reviews_lifecycleState_idx: index('gastronomy_reviews_lifecycleState_idx').on(
            table.lifecycleState
        ),
        // Composite: most common query is listByGastronomy filtered by lifecycle
        gastronomy_reviews_gastronomyId_lifecycleState_idx: index(
            'gastronomy_reviews_gastronomyId_lifecycleState_idx'
        ).on(table.gastronomyId, table.lifecycleState),
        gastronomy_reviews_moderationState_idx: index('gastronomy_reviews_moderationState_idx').on(
            table.moderationState
        )
    })
);

export const gastronomyReviewsRelations = relations(gastronomyReviews, ({ one }) => ({
    gastronomy: one(gastronomies, {
        fields: [gastronomyReviews.gastronomyId],
        references: [gastronomies.id]
    }),
    user: one(users, {
        fields: [gastronomyReviews.userId],
        references: [users.id]
    }),
    moderatedBy: one(users, {
        fields: [gastronomyReviews.moderatedById],
        references: [users.id],
        relationName: 'gastronomyReviewModerator'
    })
}));

/** Type-inferred insert type for gastronomy_reviews rows. */
export type InsertGastronomyReview = typeof gastronomyReviews.$inferInsert;
/** Type-inferred select type for gastronomy_reviews rows. */
export type SelectGastronomyReview = typeof gastronomyReviews.$inferSelect;

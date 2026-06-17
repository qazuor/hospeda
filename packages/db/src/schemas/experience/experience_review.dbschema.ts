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
import { experiences } from './experiences.dbschema.ts';

/**
 * Experience review table (SPEC-240).
 *
 * Mirrors gastronomy_reviews exactly:
 * - FK experienceId CASCADE (if the listing is deleted, reviews go with it)
 * - FK userId SET NULL (review stays when reviewer is deleted)
 * - Granular rating breakdown via jsonb (service/value/guide/overall)
 * - averageRating / overallRating / lifecycleState / moderationState
 * - Full moderation audit (moderatedById / moderatedAt / moderationReason)
 * - UNIQUE(userId, experienceId) — one review per user per listing
 */
export const experienceReviews = pgTable(
    'experience_reviews',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        experienceId: uuid('experience_id')
            .notNull()
            .references(() => experiences.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'set null' }),
        title: text('title'),
        content: text('content'),
        /** Granular rating breakdown (service/value/guide/overall). */
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
         * Moderation state defaults to PENDING: experience reviews require
         * moderator approval before appearing publicly (same as gastronomy reviews).
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
        experience_reviews_experienceId_idx: index('experience_reviews_experienceId_idx').on(
            table.experienceId
        ),
        experience_reviews_userId_idx: index('experience_reviews_userId_idx').on(table.userId),
        experience_reviews_user_experience_uniq: uniqueIndex(
            'experience_reviews_user_experience_uniq'
        ).on(table.userId, table.experienceId),
        experience_reviews_lifecycleState_idx: index('experience_reviews_lifecycleState_idx').on(
            table.lifecycleState
        ),
        // Composite: most common query is listByExperience filtered by lifecycle
        experience_reviews_experienceId_lifecycleState_idx: index(
            'experience_reviews_experienceId_lifecycleState_idx'
        ).on(table.experienceId, table.lifecycleState),
        experience_reviews_moderationState_idx: index('experience_reviews_moderationState_idx').on(
            table.moderationState
        )
    })
);

export const experienceReviewsRelations = relations(experienceReviews, ({ one }) => ({
    experience: one(experiences, {
        fields: [experienceReviews.experienceId],
        references: [experiences.id]
    }),
    user: one(users, {
        fields: [experienceReviews.userId],
        references: [users.id]
    }),
    moderatedBy: one(users, {
        fields: [experienceReviews.moderatedById],
        references: [users.id],
        relationName: 'experienceReviewModerator'
    })
}));

/** Type-inferred insert type for experience_reviews rows. */
export type InsertExperienceReview = typeof experienceReviews.$inferInsert;
/** Type-inferred select type for experience_reviews rows. */
export type SelectExperienceReview = typeof experienceReviews.$inferSelect;

import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { ModerationStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodationReviews } from './accommodation_review.dbschema.ts';

/**
 * Accommodation review replies table (HOS-2199).
 *
 * The host's single, editable answer to a review of their accommodation.
 * One LIVE reply per review is enforced by a partial UNIQUE index over
 * `review_id WHERE deleted_at IS NULL`: a deleted reply (soft delete) frees
 * the slot, so the host can answer again, and the deleted rows stay as history.
 *
 * Unlike a host-trade reply (born `PENDING`), this one defaults to `APPROVED`:
 * it publishes at once and only drops to `PENDING` when the automatic content
 * filter flags the text. An admin can hide it afterwards (`REJECTED`).
 */
export const accommodationReviewReplies = pgTable(
    'accommodation_review_replies',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** The review being answered. */
        reviewId: uuid('review_id')
            .notNull()
            .references(() => accommodationReviews.id, { onDelete: 'cascade' }),
        /** The owner who wrote the reply, frozen at writing time. */
        authorUserId: uuid('author_user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** 1..1000 chars, enforced by Zod. */
        content: text('content').notNull(),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('APPROVED'),
        moderatedById: uuid('moderated_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        moderatedAt: timestamp('moderated_at', { withTimezone: true }),
        moderationReason: text('moderation_reason'),
        /** Set on the first edit; null while the reply is as first written. */
        editedAt: timestamp('edited_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        accommodationReviewReplies_reviewId_live_uniq: uniqueIndex(
            'accommodationReviewReplies_reviewId_live_uniq'
        )
            .on(table.reviewId)
            .where(sql`${table.deletedAt} IS NULL`),
        accommodationReviewReplies_moderationState_idx: index(
            'accommodationReviewReplies_moderationState_idx'
        ).on(table.moderationState)
    })
);

export const accommodationReviewRepliesRelations = relations(
    accommodationReviewReplies,
    ({ one }) => ({
        review: one(accommodationReviews, {
            fields: [accommodationReviewReplies.reviewId],
            references: [accommodationReviews.id]
        }),
        author: one(users, {
            fields: [accommodationReviewReplies.authorUserId],
            references: [users.id],
            relationName: 'accommodationReviewReplyAuthor'
        }),
        moderatedBy: one(users, {
            fields: [accommodationReviewReplies.moderatedById],
            references: [users.id],
            relationName: 'accommodationReviewReplyModerator'
        })
    })
);

/** Drizzle-inferred SELECT type for accommodation_review_replies rows. */
export type SelectAccommodationReviewReply = typeof accommodationReviewReplies.$inferSelect;

/** Drizzle-inferred INSERT type for accommodation_review_replies rows. */
export type InsertAccommodationReviewReply = typeof accommodationReviewReplies.$inferInsert;

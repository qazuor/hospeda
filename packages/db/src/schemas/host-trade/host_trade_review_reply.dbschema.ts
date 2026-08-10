import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { ModerationStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { hostTradeReviews } from './host_trade_review.dbschema.ts';

/**
 * Host Trade Review Replies table (HOS-376 §7.1, §6.4).
 *
 * The provider's single, editable reply to a host's review — never a
 * thread, enforced by the UNIQUE index on {@link reviewId}.
 *
 * Unlike {@link hostTradeReviews} (defaults `APPROVED`), a reply defaults to
 * `moderationState = 'PENDING'`: its author was physically at the host's
 * premises and an angry reply is a real doxxing vector the review itself
 * doesn't carry, while reply volume is a small fraction of review volume —
 * so gating it does not choke the funnel.
 */
export const hostTradeReviewReplies = pgTable(
    'host_trade_review_replies',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** One reply per review — never a thread. */
        reviewId: uuid('review_id')
            .notNull()
            .references(() => hostTradeReviews.id, { onDelete: 'cascade' }),
        /** The provider's `ownerUserId` at the time of writing. */
        authorUserId: uuid('author_user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** Min 10 / max 1000 chars enforced by Zod. */
        content: text('content').notNull(),
        /** Defaults to PENDING — see the table-level doc for the rationale. */
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        /** User who performed the last moderation action. */
        moderatedById: uuid('moderated_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** Timestamp of the last moderation action. */
        moderatedAt: timestamp('moderated_at', { withTimezone: true }),
        /** Free-text reason for the moderation decision. */
        moderationReason: text('moderation_reason'),
        /**
         * Set when the underlying review is edited after this reply exists
         * (AC-22). The reply is conserved, not cleared — the directory shows
         * a banner instead of silently deleting the provider's words.
         */
        reviewEditedAfterReply: boolean('review_edited_after_reply').notNull().default(false),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        hostTradeReviewReplies_reviewId_uniq: uniqueIndex(
            'hostTradeReviewReplies_reviewId_uniq'
        ).on(table.reviewId),
        /** Backs the admin moderation queue (`GET /admin/host-trades/replies`). */
        hostTradeReviewReplies_moderationState_idx: index(
            'hostTradeReviewReplies_moderationState_idx'
        ).on(table.moderationState)
    })
);

export const hostTradeReviewRepliesRelations = relations(hostTradeReviewReplies, ({ one }) => ({
    review: one(hostTradeReviews, {
        fields: [hostTradeReviewReplies.reviewId],
        references: [hostTradeReviews.id]
    }),
    author: one(users, {
        fields: [hostTradeReviewReplies.authorUserId],
        references: [users.id],
        relationName: 'hostTradeReviewReplyAuthor'
    }),
    moderatedBy: one(users, {
        fields: [hostTradeReviewReplies.moderatedById],
        references: [users.id],
        relationName: 'hostTradeReviewReplyModerator'
    }),
    createdBy: one(users, {
        fields: [hostTradeReviewReplies.createdById],
        references: [users.id],
        relationName: 'hostTradeReviewReplyCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [hostTradeReviewReplies.updatedById],
        references: [users.id],
        relationName: 'hostTradeReviewReplyUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [hostTradeReviewReplies.deletedById],
        references: [users.id],
        relationName: 'hostTradeReviewReplyDeletedBy'
    })
}));

/** Drizzle-inferred SELECT type for host_trade_review_replies rows. */
export type SelectHostTradeReviewReply = typeof hostTradeReviewReplies.$inferSelect;

/** Drizzle-inferred INSERT type for host_trade_review_replies rows. */
export type InsertHostTradeReviewReply = typeof hostTradeReviewReplies.$inferInsert;

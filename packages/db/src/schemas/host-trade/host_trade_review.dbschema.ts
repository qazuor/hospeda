import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
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
import { hostTrades } from './host_trade.dbschema.ts';

/**
 * Optional 3-dimension rating breakdown for a `host_trade_reviews` row
 * (HOS-376 §6.3). Each dimension is 1-5; all are optional, unlike
 * {@link SelectHostTradeReview.overallRating} which is mandatory.
 */
export type HostTradeReviewRatingBreakdown = {
    workQuality?: number;
    punctuality?: number;
    treatment?: number;
};

/**
 * Host Trade Reviews table (HOS-376 §7.1, §6.3).
 *
 * A host's public review of a provider, gated on a `CONFIRMED`
 * {@link hostTradeBenefitUsages} between the same pair — the confirmation
 * requirement lives in `service-core`, not here (no FK to the usage row: the
 * usage is a precondition, not an anchor).
 *
 * Unlike the other four review tables in the repo (`accommodation_reviews`,
 * `destination_reviews`, `gastronomy_reviews`, `experience_reviews`), this
 * table defaults to `moderationState = 'APPROVED'` for a stronger reason
 * than any of them: the reviewer isn't merely "semi-verified" by a prior
 * conversation, they have a usage the provider itself confirmed.
 */
export const hostTradeReviews = pgTable(
    'host_trade_reviews',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        hostTradeId: uuid('host_trade_id')
            .notNull()
            .references(() => hostTrades.id, { onDelete: 'cascade' }),
        hostUserId: uuid('host_user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** Mandatory scalar rating, 1-5. CHECK constraint lives in extras. */
        overallRating: integer('overall_rating').notNull(),
        /**
         * Optional 3-dimension breakdown. Nullable: the create-input schema
         * marks it optional (spec §6.3 — "desglose opcional de 3 dimensiones").
         */
        rating: jsonb('rating').$type<HostTradeReviewRatingBreakdown>(),
        /**
         * Derived average of {@link rating}'s populated dimensions. Nullable
         * when there is no breakdown to average (AC-20).
         */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' }),
        /**
         * Mandatory boolean, deliberately NOT folded into the star breakdown
         * (spec §6.3): whether the provider honored the benefit is the
         * failure mode this system exists to expose.
         */
        respectedBenefit: boolean('respected_benefit').notNull(),
        /** Optional free text. Min 10 / max 2000 chars enforced by Zod. */
        content: text('content'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        /** Defaults to APPROVED — see the table-level doc for the rationale. */
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('APPROVED'),
        /** User who performed the last moderation action. */
        moderatedById: uuid('moderated_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** Timestamp of the last moderation action. */
        moderatedAt: timestamp('moderated_at', { withTimezone: true }),
        /** Free-text reason for the moderation decision. */
        moderationReason: text('moderation_reason'),
        /**
         * Set when the host edits an already-replied review (AC-22). Drives
         * re-moderation and the "reviewEditedAfterReply" marker on the reply.
         */
        editedAt: timestamp('edited_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        hostTradeReviews_hostTradeId_idx: index('hostTradeReviews_hostTradeId_idx').on(
            table.hostTradeId
        ),
        hostTradeReviews_hostUserId_idx: index('hostTradeReviews_hostUserId_idx').on(
            table.hostUserId
        ),
        hostTradeReviews_moderationState_idx: index('hostTradeReviews_moderationState_idx').on(
            table.moderationState
        ),
        hostTradeReviews_hostTradeId_moderationState_idx: index(
            'hostTradeReviews_hostTradeId_moderationState_idx'
        ).on(table.hostTradeId, table.moderationState),
        /** One review per host per provider (spec §6.3 OQ-3), editable. */
        hostTradeReviews_hostUserId_hostTradeId_uniq: uniqueIndex(
            'hostTradeReviews_hostUserId_hostTradeId_uniq'
        ).on(table.hostUserId, table.hostTradeId)
    })
);

export const hostTradeReviewsRelations = relations(hostTradeReviews, ({ one }) => ({
    hostTrade: one(hostTrades, {
        fields: [hostTradeReviews.hostTradeId],
        references: [hostTrades.id]
    }),
    hostUser: one(users, {
        fields: [hostTradeReviews.hostUserId],
        references: [users.id],
        relationName: 'hostTradeReviewHostUser'
    }),
    moderatedBy: one(users, {
        fields: [hostTradeReviews.moderatedById],
        references: [users.id],
        relationName: 'hostTradeReviewModerator'
    }),
    createdBy: one(users, {
        fields: [hostTradeReviews.createdById],
        references: [users.id],
        relationName: 'hostTradeReviewCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [hostTradeReviews.updatedById],
        references: [users.id],
        relationName: 'hostTradeReviewUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [hostTradeReviews.deletedById],
        references: [users.id],
        relationName: 'hostTradeReviewDeletedBy'
    })
}));

/** Drizzle-inferred SELECT type for host_trade_reviews rows. */
export type SelectHostTradeReview = typeof hostTradeReviews.$inferSelect;

/** Drizzle-inferred INSERT type for host_trade_reviews rows. */
export type InsertHostTradeReview = typeof hostTradeReviews.$inferInsert;

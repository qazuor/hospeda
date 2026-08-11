import { relations, sql } from 'drizzle-orm';
import { date, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
    HostTradeUsageChannelPgEnum,
    HostTradeUsageDeclaredByPgEnum,
    HostTradeUsageStatusPgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { hostTrades } from './host_trade.dbschema.ts';

/**
 * Host Trade Benefit Usages table (HOS-376 §7.1).
 *
 * "One party declares, the other confirms" — a single record of a host
 * having used a provider's benefit. Either side can open it
 * ({@link declaredBy}); only the counterpart's confirmation makes it count
 * towards {@link hostTrades}'s public numbers or unlock a review.
 *
 * See `HostTradeUsageStatusEnum` (`@repo/schemas`) for the full state
 * machine (`PENDING → CONFIRMED | REJECTED | EXPIRED`).
 */
export const hostTradeBenefitUsages = pgTable(
    'host_trade_benefit_usages',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** The provider whose benefit was used. */
        hostTradeId: uuid('host_trade_id')
            .notNull()
            .references(() => hostTrades.id, { onDelete: 'cascade' }),
        /** The host who used the benefit — the non-declaring party confirms. */
        hostUserId: uuid('host_user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** Which side opened this record. Determines who must confirm. */
        declaredBy: HostTradeUsageDeclaredByPgEnum('declared_by').notNull(),
        /** The account that actually submitted the declaration. */
        declaredById: uuid('declared_by_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** How the usage record came to exist (QR / selector / email lookup). */
        creationChannel: HostTradeUsageChannelPgEnum('creation_channel').notNull(),
        /** Current lifecycle state. Only CONFIRMED counts towards stats. */
        status: HostTradeUsageStatusPgEnum('status').notNull().default('PENDING'),
        /** When the service actually happened, as declared by the submitter. */
        servicedAt: date('serviced_at').notNull(),
        /** Free-text note from the declarant. Max 300 chars (enforced by Zod). */
        note: text('note'),
        /** `declaredAt + 30 days`. The cron flips PENDING rows past this to EXPIRED. */
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        /** Idempotency marker for the day-10 reminder cron. Null until sent. */
        reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
        /** When the counterpart confirmed. Null until confirmed. */
        confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
        /** Who confirmed. Null until confirmed. */
        confirmedById: uuid('confirmed_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** When the counterpart rejected. Null until rejected. */
        rejectedAt: timestamp('rejected_at', { withTimezone: true }),
        /** Who rejected. Null until rejected. */
        rejectedById: uuid('rejected_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** Free-text reason for the rejection. Max 300 chars (enforced by Zod). */
        rejectionNote: text('rejection_note'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        hostTradeBenefitUsages_hostTradeId_idx: index('hostTradeBenefitUsages_hostTradeId_idx').on(
            table.hostTradeId
        ),
        hostTradeBenefitUsages_hostUserId_idx: index('hostTradeBenefitUsages_hostUserId_idx').on(
            table.hostUserId
        ),
        hostTradeBenefitUsages_status_idx: index('hostTradeBenefitUsages_status_idx').on(
            table.status
        ),
        hostTradeBenefitUsages_hostTradeId_status_idx: index(
            'hostTradeBenefitUsages_hostTradeId_status_idx'
        ).on(table.hostTradeId, table.status),
        hostTradeBenefitUsages_hostUserId_status_idx: index(
            'hostTradeBenefitUsages_hostUserId_status_idx'
        ).on(table.hostUserId, table.status),
        /** Backs the daily expiry cron's `WHERE expires_at <= now()` scan. */
        hostTradeBenefitUsages_expiresAt_idx: index('hostTradeBenefitUsages_expiresAt_idx').on(
            table.expiresAt
        ),
        /**
         * Backs the single hottest query in the domain: "does a CONFIRMED usage
         * exist for this (provider, host) pair?" — the gate every review
         * creation runs through (spec §6.3).
         *
         * NOT made redundant by the partial unique index below, despite
         * covering the same two columns. That one is scoped
         * `WHERE status = 'PENDING'`, so it cannot serve a lookup for any other
         * status. Dropping this one would leave the review gate on a sequential
         * scan.
         */
        hostTradeBenefitUsages_hostTradeId_hostUserId_idx: index(
            'hostTradeBenefitUsages_hostTradeId_hostUserId_idx'
        ).on(table.hostTradeId, table.hostUserId),
        /**
         * At most one PENDING usage per (provider, host) pair — impedes
         * stacking repeated requests over the same person (spec §6.1).
         */
        hostTradeBenefitUsages_pendingPair_uniq: uniqueIndex(
            'hostTradeBenefitUsages_pendingPair_uniq'
        )
            .on(table.hostTradeId, table.hostUserId)
            .where(sql`status = 'PENDING' AND deleted_at IS NULL`)
    })
);

export const hostTradeBenefitUsagesRelations = relations(hostTradeBenefitUsages, ({ one }) => ({
    hostTrade: one(hostTrades, {
        fields: [hostTradeBenefitUsages.hostTradeId],
        references: [hostTrades.id]
    }),
    hostUser: one(users, {
        fields: [hostTradeBenefitUsages.hostUserId],
        references: [users.id],
        relationName: 'hostTradeBenefitUsageHostUser'
    }),
    declaredByUser: one(users, {
        fields: [hostTradeBenefitUsages.declaredById],
        references: [users.id],
        relationName: 'hostTradeBenefitUsageDeclaredBy'
    }),
    confirmedByUser: one(users, {
        fields: [hostTradeBenefitUsages.confirmedById],
        references: [users.id],
        relationName: 'hostTradeBenefitUsageConfirmedBy'
    }),
    rejectedByUser: one(users, {
        fields: [hostTradeBenefitUsages.rejectedById],
        references: [users.id],
        relationName: 'hostTradeBenefitUsageRejectedBy'
    }),
    createdBy: one(users, {
        fields: [hostTradeBenefitUsages.createdById],
        references: [users.id],
        relationName: 'hostTradeBenefitUsageCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [hostTradeBenefitUsages.updatedById],
        references: [users.id],
        relationName: 'hostTradeBenefitUsageUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [hostTradeBenefitUsages.deletedById],
        references: [users.id],
        relationName: 'hostTradeBenefitUsageDeletedBy'
    })
}));

/** Drizzle-inferred SELECT type for host_trade_benefit_usages rows. */
export type SelectHostTradeBenefitUsage = typeof hostTradeBenefitUsages.$inferSelect;

/** Drizzle-inferred INSERT type for host_trade_benefit_usages rows. */
export type InsertHostTradeBenefitUsage = typeof hostTradeBenefitUsages.$inferInsert;

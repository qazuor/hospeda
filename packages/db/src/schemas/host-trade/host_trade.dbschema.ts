import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    numeric,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { destinations } from '../destination/destination.dbschema.ts';
import { HostTradeBenefitTypePgEnum, HostTradeCategoryPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { hostTradeBenefitUsages } from './host_trade_benefit_usage.dbschema.ts';
import { hostTradeReviews } from './host_trade_review.dbschema.ts';

/**
 * Host Trades table (SPEC-241)
 *
 * Admin-curated directory of local tradespeople / service providers that hosts
 * can consult when they need urgent help (plumber, electrician, locksmith, etc.).
 * One entry per provider per destination.
 */
export const hostTrades = pgTable(
    'host_trades',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        /** Service category (e.g. PLOMERIA, ELECTRICIDAD). Drives directory filtering. */
        category: HostTradeCategoryPgEnum('category').notNull(),
        /** Contact information (phone, WhatsApp, email, etc.) — free text. */
        contact: text('contact').notNull(),
        /**
         * Fine print of the benefit: conditions, exclusions, validity.
         *
         * Was the WHOLE benefit until HOS-278 §6.4 gave it a structured shape;
         * it is now the prose that accompanies {@link benefitType} /
         * {@link benefitValue}. Kept `notNull` and un-renamed on purpose — the
         * schema compatibility policy is additive-only, and every row that
         * predates the structured columns still carries its offer here.
         */
        benefit: text('benefit').notNull(),
        /**
         * Structured benefit shape (HOS-278 §6.4). Nullable because listings
         * created before the structured columns existed only have the prose.
         */
        benefitType: HostTradeBenefitTypePgEnum('benefit_type'),
        /**
         * Benefit magnitude, interpreted by {@link benefitType}: whole percent
         * for `PERCENTAGE`, centavos for `FIXED_AMOUNT`, null for the rest.
         * The pairing is enforced by `refineHostTradeBenefit` in `@repo/schemas`.
         */
        benefitValue: integer('benefit_value'),
        /** Geographic destination this trade entry belongs to. */
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'restrict' }),
        /** Whether the provider is available 24 hours a day. */
        is24h: boolean('is_24h').notNull().default(false),
        /** Human-readable schedule description (nullable — use is24h for 24h providers). */
        scheduleText: text('schedule_text'),
        /** Whether this entry is publicly visible in the host directory. */
        isActive: boolean('is_active').notNull().default(true),
        /**
         * The account that owns this listing and may edit its operational
         * fields from `/mi-cuenta` (HOS-278 AC-7).
         *
         * Nullable for two distinct reasons, both real: every listing that
         * predates HOS-278 was admin-curated and belongs to nobody, and an
         * approved application whose applicant never confirmed their email
         * (`alliance_leads.applicant_user_id IS NULL`) provisions a listing
         * with no owner yet — the claim flow backfills it later.
         *
         * A null owner is what makes the ownership filter fail CLOSED: a query
         * scoped to the actor can never match it.
         */
        ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
        /**
         * A benefit edit awaiting admin review (HOS-278 AC-8).
         *
         * The pending copy is deliberately SEPARATE from the live columns
         * rather than a `moderationState` on the row: the benefit is the
         * provider's consideration for being listed, so an edit must never take
         * the vetted offer — or the whole listing — off the directory while it
         * waits. The public directory always reads the live columns; these are
         * invisible to it.
         *
         * `null` here does NOT mean "no benefit", it means "nothing pending".
         */
        pendingBenefitType: HostTradeBenefitTypePgEnum('pending_benefit_type'),
        /** Pending counterpart of {@link benefitValue}. */
        pendingBenefitValue: integer('pending_benefit_value'),
        /** Pending counterpart of {@link benefit} (the fine print). */
        pendingBenefitText: text('pending_benefit_text'),
        /**
         * Review state of the pending benefit edit: `'pending'` or null.
         *
         * An explicit marker rather than inferring from the pending columns:
         * an edit that only rewrites the fine print leaves
         * {@link pendingBenefitType} null, and inferring would silently treat
         * that as "nothing to review".
         */
        benefitReviewState: varchar('benefit_review_state', { length: 20 }),
        /**
         * When this listing was revoked (HOS-278 R-4), or null if it was not.
         *
         * Revoking sets {@link isActive} false and fills this trio. It never
         * deletes the row: the listing must stay auditable, and the provider's
         * history of having been approved is itself a fact worth keeping. This
         * is deliberately NOT `deletedAt` — a revoked listing is still visible
         * to admins in normal queries, a soft-deleted one is not.
         */
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        /** Admin who revoked the listing. */
        revokedById: uuid('revoked_by_id').references(() => users.id, { onDelete: 'set null' }),
        /** Why it was revoked. Surfaced to the provider in the notification. */
        revokeReason: text('revoke_reason'),
        /**
         * Denormalized count of CONFIRMED {@link hostTradeBenefitUsages} rows
         * (HOS-376 §7.2). Recalculated from TS in the `_after*` service hooks,
         * mirroring `recalculateAndUpdateAccommodationStats` — no Postgres
         * trigger.
         */
        confirmedUsesCount: integer('confirmed_uses_count').notNull().default(0),
        /**
         * Denormalized count of distinct hosts among CONFIRMED usages
         * (HOS-376 §7.2, §6.5). The anti-collusion signal shown next to
         * {@link confirmedUsesCount} on the public directory card.
         */
        distinctHostsCount: integer('distinct_hosts_count').notNull().default(0),
        /** Denormalized count of `APPROVED` {@link hostTradeReviews} rows. */
        reviewsCount: integer('reviews_count').notNull().default(0),
        /** Denormalized average of `APPROVED` reviews' `overallRating`. */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
            .notNull()
            .default(0),
        /** Denormalized count of `APPROVED` reviews with `respectedBenefit = true`. */
        benefitRespectedCount: integer('benefit_respected_count').notNull().default(0),
        /**
         * When declaration was suspended for this provider (HOS-376 §6.5).
         * Null = not suspended. Non-null does NOT imply an admin acted —
         * see {@link declarationSuspendedById}.
         */
        declarationSuspendedAt: timestamp('declaration_suspended_at', { withTimezone: true }),
        /**
         * Who suspended declaration. Null means the rejection-threshold cron
         * applied it automatically; non-null means an admin applied or
         * lifted it (HOS-376 AC-11/AC-12).
         */
        declarationSuspendedById: uuid('declaration_suspended_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** Why declaration was suspended. Surfaced to the provider. */
        declarationSuspendReason: text('declaration_suspend_reason'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        hostTrades_destinationId_idx: index('hostTrades_destinationId_idx').on(table.destinationId),
        hostTrades_category_idx: index('hostTrades_category_idx').on(table.category),
        hostTrades_isActive_idx: index('hostTrades_isActive_idx').on(table.isActive),
        hostTrades_destinationId_category_idx: index('hostTrades_destinationId_category_idx').on(
            table.destinationId,
            table.category
        ),
        /** Backs the owner-scoped `/protected/host-trades/mine` lookup (AC-7). */
        hostTrades_ownerUserId_idx: index('hostTrades_ownerUserId_idx').on(table.ownerUserId)
    })
);

export const hostTradesRelations = relations(hostTrades, ({ one, many }) => ({
    destination: one(destinations, {
        fields: [hostTrades.destinationId],
        references: [destinations.id]
    }),
    owner: one(users, {
        fields: [hostTrades.ownerUserId],
        references: [users.id],
        relationName: 'hostTradeOwner'
    }),
    revokedBy: one(users, {
        fields: [hostTrades.revokedById],
        references: [users.id],
        relationName: 'hostTradeRevokedBy'
    }),
    /** Null when the rejection-threshold cron applied the suspension automatically. */
    declarationSuspendedBy: one(users, {
        fields: [hostTrades.declarationSuspendedById],
        references: [users.id],
        relationName: 'hostTradeDeclarationSuspendedBy'
    }),
    createdBy: one(users, {
        fields: [hostTrades.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [hostTrades.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [hostTrades.deletedById],
        references: [users.id]
    }),
    /** All benefit-usage records declared/confirmed against this provider (HOS-376). */
    usages: many(hostTradeBenefitUsages),
    /** All reviews left for this provider (HOS-376). */
    reviews: many(hostTradeReviews)
}));

/** Drizzle-inferred SELECT type for host_trades rows. */
export type SelectHostTrade = typeof hostTrades.$inferSelect;

/** Drizzle-inferred INSERT type for host_trades rows. */
export type InsertHostTrade = typeof hostTrades.$inferInsert;

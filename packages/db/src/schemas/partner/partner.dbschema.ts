import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingPlans, billingSubscriptions } from '../../billing/index.ts';
import {
    LifecycleStatusPgEnum,
    PartnerSubscriptionStatusPgEnum,
    PartnerTierPgEnum,
    PartnerTypePgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Analytics data stored as JSONB
 */
export interface PartnerAnalytics {
    impressions?: number;
    clicks?: number;
}

export const partners = pgTable(
    'partners',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: varchar('slug', { length: 255 }).notNull().unique(),
        name: varchar('name', { length: 255 }).notNull(),
        type: PartnerTypePgEnum('type').notNull(),
        tier: PartnerTierPgEnum('tier').notNull(),
        logoUrl: text('logo_url'),
        websiteUrl: text('website_url'),
        description: text('description'),
        subscriptionStatus: PartnerSubscriptionStatusPgEnum('subscription_status')
            .notNull()
            .default('pending'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        analytics: jsonb('analytics').$type<PartnerAnalytics>().default({}),
        planId: uuid('plan_id').references(() => billingPlans.id, {
            onDelete: 'set null'
        }),
        subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id, {
            onDelete: 'set null'
        }),
        /**
         * The account that owns this partner listing (HOS-278 §6.5).
         *
         * Set when an approved `partner` alliance lead is provisioned, and
         * backfilled by the claim flow when an anonymous applicant later
         * redeems their token. Mirrors `host_trades.owner_user_id`, including
         * the reason it is nullable: a null owner is what makes the ownership
         * filter fail CLOSED, since a query scoped to the actor can never
         * match it. Curated partners created by hand in the admin have no
         * owner at all and are meant to stay that way.
         */
        ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
        /**
         * When the alliance actually began — NULL until it does (HOS-278 D1).
         *
         * Nullable because provisioning creates the row BEFORE any payment:
         * a DRAFT partner has been approved but has not started, and this
         * column previously had no way to say so. It was NOT NULL with no
         * default, so every writer had to invent a date — the admin form
         * still defaults to today — and that invented date was indexed by
         * `partners_startsAt_idx` alongside the real ones, indistinguishable
         * from them. NULL is now the honest answer, written for real only
         * when the partner subscription activates.
         */
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        // Audit fields
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        partners_slug_idx: index('partners_slug_idx').on(table.slug),
        partners_type_idx: index('partners_type_idx').on(table.type),
        partners_tier_idx: index('partners_tier_idx').on(table.tier),
        partners_subscriptionStatus_idx: index('partners_subscriptionStatus_idx').on(
            table.subscriptionStatus
        ),
        partners_lifecycleState_idx: index('partners_lifecycleState_idx').on(table.lifecycleState),
        partners_startsAt_idx: index('partners_startsAt_idx').on(table.startsAt),
        partners_ownerUserId_idx: index('partners_ownerUserId_idx').on(table.ownerUserId),
        partners_deletedAt_idx: index('partners_deletedAt_idx').on(table.deletedAt),
        // Composite index for findActivePartners (filters by both subscriptionStatus and lifecycleState)
        partners_subscriptionStatus_lifecycleState_idx: index(
            'partners_subscriptionStatus_lifecycleState_idx'
        ).on(table.subscriptionStatus, table.lifecycleState),
        // Anticipatory composite for partner-expiry cron
        partners_lifecycleState_endsAt_idx: index('partners_lifecycleState_endsAt_idx').on(
            table.lifecycleState,
            table.endsAt
        )
    })
);

export const partnersRelations = relations(partners, ({ one }) => ({
    owner: one(users, {
        fields: [partners.ownerUserId],
        references: [users.id],
        relationName: 'partnerOwner'
    }),
    createdBy: one(users, { fields: [partners.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [partners.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [partners.deletedById], references: [users.id] }),
    plan: one(billingPlans, {
        fields: [partners.planId],
        references: [billingPlans.id]
    }),
    subscription: one(billingSubscriptions, {
        fields: [partners.subscriptionId],
        references: [billingSubscriptions.id]
    })
}));

/** Type-inferred insert type for partners rows. */
export type InsertPartner = typeof partners.$inferInsert;
/** Type-inferred select type for partners rows. */
export type SelectPartner = typeof partners.$inferSelect;

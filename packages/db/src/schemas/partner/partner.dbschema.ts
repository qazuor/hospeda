import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingSubscriptions } from '../../billing/index.ts';
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
        planId: varchar('plan_id', { length: 36 }).references(() => billingSubscriptions.id, {
            onDelete: 'set null'
        }),
        subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id, {
            onDelete: 'set null'
        }),
        startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
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
    createdBy: one(users, { fields: [partners.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [partners.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [partners.deletedById], references: [users.id] }),
    plan: one(billingSubscriptions, {
        fields: [partners.planId],
        references: [billingSubscriptions.id]
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

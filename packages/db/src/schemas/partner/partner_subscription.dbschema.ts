import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingSubscriptions } from '../../billing/index.ts';

/**
 * Partner subscription link table (SPEC-271).
 *
 * Core join between a QZPay billing subscription and a partner entity.
 * Provides fast-read status without joining the library-owned billing_subscriptions
 * table on every public request.
 *
 * FK to billing_subscriptions: expressed via Drizzle's `.references()` because
 * `billingSubscriptions` is re-exported from `@qazuor/qzpay-drizzle` through
 * the db package's own `src/billing/index.ts`. Same pattern already used by
 * `billing_subscription_events` in this codebase.
 *
 * UNIQUE(partner_id): a partner can only have ONE active subscription link at a time.
 */
export const partnerSubscriptions = pgTable(
    'partner_subscriptions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * FK to the QZPay billing subscription. Expressed via Drizzle references()
         * using the re-exported `billingSubscriptions` table object.
         */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        /**
         * Domain discriminator — always 'partner' for this spec; reserved for
         * future multi-domain extension without a schema change.
         */
        productDomain: varchar('product_domain', { length: 50 }).notNull().default('partner'),
        /** UUID of the linked partner entity (partners.id). */
        partnerId: uuid('partner_id').notNull(),
        /**
         * Denormalized subscription status for fast public reads.
         * Mirrors billing_subscriptions.status; updated by the billing webhook handler.
         */
        status: varchar('status', { length: 50 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // One active subscription per partner entity
        partner_subs_partner_uniq: uniqueIndex('partner_subs_partner_uniq').on(table.partnerId),
        partner_subs_partnerId_idx: index('partner_subs_partnerId_idx').on(table.partnerId),
        partner_subs_status_idx: index('partner_subs_status_idx').on(table.status)
    })
);

export const partnerSubscriptionsRelations = relations(partnerSubscriptions, ({ one }) => ({
    subscription: one(billingSubscriptions, {
        fields: [partnerSubscriptions.subscriptionId],
        references: [billingSubscriptions.id]
    })
}));

/** Type-inferred insert type for partner_subscriptions rows. */
export type InsertPartnerSubscription = typeof partnerSubscriptions.$inferInsert;
/** Type-inferred select type for partner_subscriptions rows. */
export type SelectPartnerSubscription = typeof partnerSubscriptions.$inferSelect;

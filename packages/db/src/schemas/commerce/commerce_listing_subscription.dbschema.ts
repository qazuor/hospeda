import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingSubscriptions } from '../../billing/index.ts';

/**
 * Commerce listing subscription link table (SPEC-239 T-022).
 *
 * Core join between a QZPay billing subscription and a commerce entity
 * (gastronomy, experience, etc.). Provides fast-read status without joining
 * the library-owned billing_subscriptions table on every public request.
 *
 * FK to billing_subscriptions: expressed via Drizzle's `.references()` because
 * `billingSubscriptions` is re-exported from `@qazuor/qzpay-drizzle` through
 * the db package's own `src/billing/index.ts`. Same pattern already used by
 * `billing_subscription_events` in this codebase.
 *
 * UNIQUE(entity_type, entity_id): a commerce entity can only have ONE active
 * subscription link at a time.
 */
export const commerceListingSubscriptions = pgTable(
    'commerce_listing_subscriptions',
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
         * Domain discriminator — always 'commerce' for this spec; reserved for
         * future multi-domain extension without a schema change.
         */
        productDomain: varchar('product_domain', { length: 50 }).notNull().default('commerce'),
        /**
         * Entity type discriminator. Current values: 'gastronomy' | 'experience'.
         * Stored as varchar so new entity types can be added without an enum migration.
         */
        entityType: varchar('entity_type', { length: 50 }).notNull(),
        /** UUID of the linked commerce entity (gastronomies.id, etc.). */
        entityId: uuid('entity_id').notNull(),
        /**
         * Denormalized subscription status for fast public reads.
         * Mirrors billing_subscriptions.status; updated by the billing webhook handler.
         */
        status: varchar('status', { length: 50 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // One active subscription per commerce entity
        commerce_listing_subs_entity_uniq: uniqueIndex('commerce_listing_subs_entity_uniq').on(
            table.entityType,
            table.entityId
        ),
        commerce_listing_subs_entityId_idx: index('commerce_listing_subs_entityId_idx').on(
            table.entityId
        ),
        commerce_listing_subs_status_idx: index('commerce_listing_subs_status_idx').on(table.status)
    })
);

export const commerceListingSubscriptionsRelations = relations(
    commerceListingSubscriptions,
    ({ one }) => ({
        subscription: one(billingSubscriptions, {
            fields: [commerceListingSubscriptions.subscriptionId],
            references: [billingSubscriptions.id]
        })
    })
);

/** Type-inferred insert type for commerce_listing_subscriptions rows. */
export type InsertCommerceListingSubscription = typeof commerceListingSubscriptions.$inferInsert;
/** Type-inferred select type for commerce_listing_subscriptions rows. */
export type SelectCommerceListingSubscription = typeof commerceListingSubscriptions.$inferSelect;

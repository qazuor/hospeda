import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingSubscriptions } from '../../billing/index.ts';

/**
 * `entity_subscriptions` — ONE denormalized subscription-status cache shared by
 * every vertical (HOS-1084).
 *
 * Formerly `commerce_listing_subscriptions` (SPEC-239 T-022), which served only
 * gastronomy and experience. Its columns were already generic over
 * `entityType`, so HOS-1084 renamed the table rather than adding a second one:
 * **one table for the three verticals, one reconciler**.
 *
 * ---
 * WHAT IT IS FOR
 *
 * Two distinct jobs, and not every vertical needs both:
 *
 * 1. **Map a subscription to the listings it covers.** Commerce needs this: a
 *    gastronomy subscription is per-OWNER-per-VERTICAL (HOS-688) and the
 *    visibility reconciler has no other way to learn which restaurants it
 *    publishes. Accommodation does NOT need it — it resolves its listings from
 *    `accommodations.owner_id`.
 * 2. **Read the status without joining `billing_subscriptions` on every public
 *    request.** BOTH need this, and it is the half accommodation was missing:
 *    its public reads resolved owner entitlements live against QZPay
 *    (customer lookup → subscriptions → plan) on every cold render, patched
 *    over with hand-rolled per-process in-memory caches that died on each
 *    deploy and were never shared between instances.
 *
 * ---
 * ROW SHAPE PER VERTICAL
 *
 * | vertical      | `entity_type`     | `entity_id`         | rows per subscription |
 * |---------------|-------------------|---------------------|-----------------------|
 * | gastronomy    | `'gastronomy'`    | `gastronomies.id`   | 1..cap (1/3/10)       |
 * | experience    | `'experience'`    | `experiences.id`    | 1..cap                |
 * | accommodation | `'accommodation'` | `accommodations.id` | 1..N (owner's whole portfolio) |
 *
 * `UNIQUE(entity_type, entity_id)` is therefore **per LISTING, never per
 * subscription**: one subscription legitimately owns many rows. A unique
 * constraint on `subscription_id` would reject the second property of every
 * multi-property host and the second restaurant of every capped commerce owner.
 *
 * ---
 * A DESYNCED CACHE IS WORSE THAN NO CACHE
 *
 * A stale row publishes a listing whose owner stopped paying, or hides one
 * whose owner is paying. Three things keep that from happening, in order of how
 * often they fire:
 *
 * 1. every billing-lifecycle site writes through this table via the single
 *    reconciler (`reconcileSubscriptionLinkedEntities`) — the MP webhook,
 *    dunning, `finalize-cancelled-subs`, `abandoned-pending-subs`,
 *    `preapproval-less-expiry` and the commerce attach path;
 * 2. the `entity-subscription-cache-reconcile` cron re-derives every
 *    accommodation row from live billing on a schedule, as the backstop for
 *    anything the write path missed (a dropped webhook, a crash between the
 *    billing write and this one);
 * 3. a **missing** row is never a correctness bug: the public read falls back
 *    to the live billing resolution it used before this table existed. Only a
 *    row that is present AND wrong can lie, which is what (1) and (2) defend.
 *
 * ---
 * FK to `billing_subscriptions` is expressed via Drizzle's `.references()`
 * because `billingSubscriptions` is re-exported from `@qazuor/qzpay-drizzle`
 * through the db package's own `src/billing/index.ts`. Same pattern already
 * used by `billing_subscription_events`.
 */
export const entitySubscriptions = pgTable(
    'entity_subscriptions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * FK to the QZPay billing subscription, or `NULL` for a
         * **negative-cache** row (see {@link ENTITY_SUBSCRIPTION_STATUS_NONE}).
         *
         * Nullable since HOS-1084. Commerce rows always carry a subscription —
         * a listing with no subscription simply has no row. Accommodation is
         * the opposite: the overwhelmingly common case is a host with NO
         * subscription at all, and "this owner has nothing" is precisely the
         * answer the public read needs cached. Without a row for them, every
         * request for the most common owner would fall through to the live
         * billing path the cache exists to avoid.
         */
        subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id, {
            onDelete: 'cascade'
        }),
        /**
         * Domain discriminator — the billing vertical this row belongs to
         * (`'accommodation'` | `'gastronomy'` | `'experience'`, or the
         * pre-HOS-685 `'commerce'` umbrella on rows the HOS-692 rewrite has not
         * reached).
         *
         * No default (HOS-692, structural migration 0094 drops the old
         * `.default('commerce')`): the value is fully derivable from this same
         * row's `entityType`, and a default that can silently disagree with its
         * own row is worse than a required field every write site must set
         * explicitly.
         */
        productDomain: varchar('product_domain', { length: 50 }).notNull(),
        /**
         * Entity type discriminator. Current values: `'accommodation'` |
         * `'gastronomy'` | `'experience'`. Stored as varchar so a new vertical
         * can be added without an enum migration.
         */
        entityType: varchar('entity_type', { length: 50 }).notNull(),
        /** UUID of the linked entity (`accommodations.id`, `gastronomies.id`, …). */
        entityId: uuid('entity_id').notNull(),
        /**
         * Denormalized subscription status for fast public reads.
         * Mirrors `billing_subscriptions.status`, or
         * {@link ENTITY_SUBSCRIPTION_STATUS_NONE} when the owner holds no
         * subscription for this vertical at all.
         */
        status: varchar('status', { length: 50 }).notNull(),
        /**
         * Denormalized `billing_subscriptions.plan_id` (a plan UUID stored in a
         * varchar column upstream — mirrored as varchar here for the same
         * reason).
         *
         * Added by HOS-1084 and load-bearing for the accommodation read: the
         * status alone answers "is this owner paying", but every public gate
         * asks "WHAT does their plan grant", and without the plan id the read
         * would still have to walk customer → subscriptions to find it, which
         * is the walk the cache exists to remove. `NULL` on a negative-cache
         * row, and on commerce rows written before this column existed
         * (commerce reads its plan from the subscription, so it never needs it).
         */
        planId: varchar('plan_id', { length: 255 }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // One row per LISTING — never per subscription. See the module JSDoc.
        entity_subs_entity_uniq: uniqueIndex('entity_subs_entity_uniq').on(
            table.entityType,
            table.entityId
        ),
        entity_subs_entityId_idx: index('entity_subs_entityId_idx').on(table.entityId),
        entity_subs_status_idx: index('entity_subs_status_idx').on(table.status),
        // The reconciler and the slot counter both look rows up by subscription;
        // under the per-listing model that is a 1-to-many read, not a unique hit.
        entity_subs_subscriptionId_idx: index('entity_subs_subscriptionId_idx').on(
            table.subscriptionId
        )
    })
);

/**
 * Sentinel `status` for a NEGATIVE-CACHE row: the entity exists, and its owner
 * holds no subscription for this vertical.
 *
 * Deliberately not a member of `SubscriptionStatusEnum` — no
 * `billing_subscriptions` row ever carries it, and it must never be mistaken
 * for one. It is the answer "there is nothing to find", cached so the public
 * read does not have to re-discover it against QZPay on every request.
 */
export const ENTITY_SUBSCRIPTION_STATUS_NONE = 'none';

export const entitySubscriptionsRelations = relations(entitySubscriptions, ({ one }) => ({
    subscription: one(billingSubscriptions, {
        fields: [entitySubscriptions.subscriptionId],
        references: [billingSubscriptions.id]
    })
}));

/** Type-inferred insert type for `entity_subscriptions` rows. */
export type InsertEntitySubscription = typeof entitySubscriptions.$inferInsert;
/** Type-inferred select type for `entity_subscriptions` rows. */
export type SelectEntitySubscription = typeof entitySubscriptions.$inferSelect;

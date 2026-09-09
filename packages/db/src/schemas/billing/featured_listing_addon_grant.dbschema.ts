import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingAddonPurchases } from './billing_addon_purchase.dbschema.ts';

/**
 * Featured listing addon grant link table (SPEC-309 T-002, OQ-3; made
 * polymorphic over the three verticals by HOS-1286).
 *
 * Ties one `visibility-boost` addon purchase to exactly one LISTING, since
 * `billing_addon_purchases` has no listing reference and a
 * unique-active-per-(customerId, addonSlug) constraint (an owner can only ever
 * have ONE active purchase per addon slug regardless of listing count).
 *
 * No denormalized `status`/`expiresAt` columns here — the featured-entitlement
 * resolver JOINs to `billing_addon_purchases` for
 * `status = 'active' AND (expires_at IS NULL OR expires_at > now())` so purchase
 * lifecycle state has exactly one source of truth.
 *
 * ---
 * ## HOS-1286 — why `(entity_type, entity_id)` and not `accommodation_id`
 *
 * The owner decided (2026-09-08) that featuring-by-entitlement works for all
 * three verticals. The single blocker was this table's foreign key: it pointed
 * at `accommodations.id` alone, so an addon purchase could not name a
 * gastronomy or experience listing at all.
 *
 * The shape is copied from `entity_subscriptions` — `entity_type varchar` +
 * `entity_id uuid` with NO foreign key — which is the polymorphic reference this
 * repo already validated across the same three verticals (HOS-1084). It is
 * COPIED and deliberately NOT pointed at: a row in `entity_subscriptions` may
 * legitimately be ABSENT (its own docblock: "a missing row is never a
 * correctness bug", the public read falls back to live billing), and its
 * accommodation rows are rebuilt WHOLE by the
 * `entity-subscription-cache-reconcile` cron. Hanging a PAID grant off a row
 * that is allowed to vanish or be recreated would lose bought featuring in
 * silence.
 *
 * ### What the dropped FK used to buy, and what replaces it
 *
 * The FK gave two things for free, and both have to be paid for elsewhere now:
 *
 * 1. **Referential integrity across verticals.** Nothing at the database level
 *    stops a row claiming `entity_type = 'gastronomy'` while its `entity_id` is
 *    really an accommodation's. Every read of this table therefore MUST filter
 *    on `entity_type` as well as `entity_id` — never on the id alone. That is
 *    not a style preference: it is the invariant the FK used to enforce, moved
 *    into the query layer, and it is what the cross-vertical tests in
 *    `featured-addon-grant.resolver.test.ts` exist to hold.
 * 2. **`ON DELETE CASCADE` pruning.** A hard-deleted listing no longer takes its
 *    grants with it. Orphan rows are harmless rather than wrong: every consumer
 *    joins from the grant to the listing table, so an orphan matches nothing and
 *    grants no featuring. `entity_subscriptions` accepts the identical trade.
 *
 * The `purchase_id` FK is untouched — that one is not polymorphic and still
 * cascades.
 */
export const featuredListingAddonGrants = pgTable(
    'featured_listing_addon_grants',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        purchaseId: uuid('purchase_id')
            .notNull()
            .references(() => billingAddonPurchases.id, { onDelete: 'cascade' }),
        /**
         * Which vertical's table {@link featuredListingAddonGrants.entityId}
         * points into: `'accommodation'` | `'gastronomy'` | `'experience'`.
         *
         * Stored as varchar so a fourth vertical needs no enum migration — the
         * same reasoning `entity_subscriptions.entity_type` gives.
         *
         * **No default, on purpose.** HOS-692 dropped the analogous
         * `.default('commerce')` from `entity_subscriptions.product_domain`
         * because a default that can silently disagree with its own row is worse
         * than a required field every write site must state. The same applies
         * here with sharper teeth: a defaulted `'accommodation'` on a gastronomy
         * grant would feature the wrong listing, and the FK that used to make
         * that impossible is gone.
         */
        entityType: varchar('entity_type', { length: 50 }).notNull(),
        /**
         * UUID of the granted listing — `accommodations.id`, `gastronomies.id`
         * or `experiences.id`, per `entityType`. No FK: see the module docblock.
         */
        entityId: uuid('entity_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // One purchase links to exactly one listing.
        featuredListingAddonGrants_purchaseId_uniq: uniqueIndex(
            'featuredListingAddonGrants_purchaseId_uniq'
        ).on(table.purchaseId),
        // Resolver lookup path: find active grants by listing. Composite over
        // BOTH columns, mirroring `entity_subs_entity_uniq`, because a lookup on
        // `entity_id` alone is exactly the cross-vertical read the dropped FK
        // used to make impossible.
        featuredListingAddonGrants_entity_idx: index('featuredListingAddonGrants_entity_idx').on(
            table.entityType,
            table.entityId
        )
    })
);

export const featuredListingAddonGrantsRelations = relations(
    featuredListingAddonGrants,
    ({ one }) => ({
        purchase: one(billingAddonPurchases, {
            fields: [featuredListingAddonGrants.purchaseId],
            references: [billingAddonPurchases.id]
        })
        // No `accommodation` relation: the target table is chosen at runtime by
        // `entityType`, which Drizzle's `relations()` cannot express. Consumers
        // join explicitly against the table their `entityType` names.
    })
);

/** Type-inferred insert type for featured_listing_addon_grants rows. */
export type InsertFeaturedListingAddonGrant = typeof featuredListingAddonGrants.$inferInsert;
/** Type-inferred select type for featured_listing_addon_grants rows. */
export type SelectFeaturedListingAddonGrant = typeof featuredListingAddonGrants.$inferSelect;

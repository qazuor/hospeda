import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { billingAddonPurchases } from './billing_addon_purchase.dbschema.ts';

/**
 * Featured listing addon grant link table (SPEC-309 T-002, OQ-3).
 *
 * Ties one `visibility-boost` addon purchase to exactly one accommodation, since
 * `billing_addon_purchases` has no accommodation reference and a
 * unique-active-per-(customerId, addonSlug) constraint (an owner can only ever
 * have ONE active purchase per addon slug regardless of accommodation count).
 * Mirrors the `commerce_listing_subscriptions` link-table pattern.
 *
 * No denormalized `status`/`expiresAt` columns here — the featured-entitlement
 * resolver (T-004) JOINs to `billing_addon_purchases` for
 * `status = 'active' AND (expires_at IS NULL OR expires_at > now())` so purchase
 * lifecycle state has exactly one source of truth.
 */
export const featuredListingAddonGrants = pgTable(
    'featured_listing_addon_grants',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        purchaseId: uuid('purchase_id')
            .notNull()
            .references(() => billingAddonPurchases.id, { onDelete: 'cascade' }),
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // One purchase links to exactly one accommodation.
        featuredListingAddonGrants_purchaseId_uniq: uniqueIndex(
            'featuredListingAddonGrants_purchaseId_uniq'
        ).on(table.purchaseId),
        // Resolver lookup path (T-004): find active grants by accommodation.
        featuredListingAddonGrants_accommodationId_idx: index(
            'featuredListingAddonGrants_accommodationId_idx'
        ).on(table.accommodationId)
    })
);

export const featuredListingAddonGrantsRelations = relations(
    featuredListingAddonGrants,
    ({ one }) => ({
        purchase: one(billingAddonPurchases, {
            fields: [featuredListingAddonGrants.purchaseId],
            references: [billingAddonPurchases.id]
        }),
        accommodation: one(accommodations, {
            fields: [featuredListingAddonGrants.accommodationId],
            references: [accommodations.id]
        })
    })
);

/** Type-inferred insert type for featured_listing_addon_grants rows. */
export type InsertFeaturedListingAddonGrant = typeof featuredListingAddonGrants.$inferInsert;
/** Type-inferred select type for featured_listing_addon_grants rows. */
export type SelectFeaturedListingAddonGrant = typeof featuredListingAddonGrants.$inferSelect;

import type { AccommodationExternalListing } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { ExternalPlatformPgEnum, LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodationExternalReputation } from './accommodation_external_reputation.dbschema.ts';

/**
 * Table storing owner-registered external listing links.
 * One row per (accommodation, platform) pair.
 *
 * The owner provides the URL and optional externalId so the background
 * reputation fetcher can resolve the correct place/listing on the platform.
 *
 * Audit + lifecycle fields mirror the convention used across all entities
 * in this codebase (same as accommodation_reviews, accommodation_faqs, etc.).
 */
export const accommodationExternalListings = pgTable(
    'accommodation_external_listings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** FK to the accommodation this listing belongs to. */
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        /** Platform identifier (GOOGLE, BOOKING, AIRBNB, OTHER). */
        platform: ExternalPlatformPgEnum('platform').notNull(),
        /** Full public URL to the listing on the external platform. */
        url: text('url').notNull(),
        /**
         * Platform-specific listing identifier (e.g. Google place_id).
         * Used by the reputation fetcher; not surfaced publicly.
         */
        externalId: text('external_id'),
        /** When true, the public detail page shows a link to this listing. */
        showLink: boolean('show_link').notNull().default(false),
        /** When true, review snippets fetched from this platform are shown publicly. */
        showReviews: boolean('show_reviews').notNull().default(false),
        /** Set to true by an admin after the listing URL has been verified as genuine. */
        verified: boolean('verified').notNull().default(false),
        // ---- Standard BaseAuditFields ----
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        // ---- Standard BaseLifecycleFields ----
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE')
    },
    (table) => ({
        /** Index for the FK lookup — all listings for a given accommodation. */
        accommodation_external_listings_accommodationId_idx: index(
            'accommodation_external_listings_accommodationId_idx'
        ).on(table.accommodationId),
        /** Index to filter by platform across all accommodations. */
        accommodation_external_listings_platform_idx: index(
            'accommodation_external_listings_platform_idx'
        ).on(table.platform),
        /** Soft-delete index for the standard isNull(deletedAt) pattern. */
        accommodation_external_listings_deletedAt_idx: index(
            'accommodation_external_listings_deletedAt_idx'
        ).on(table.deletedAt),
        /**
         * Unique constraint: one listing per (accommodation, platform) pair.
         * Enforced at the DB level to guarantee the ON CONFLICT upsert in the
         * reputation model targets exactly one row.
         */
        accommodation_external_listings_accommodation_platform_uniq: uniqueIndex(
            'accommodation_external_listings_accommodation_platform_uniq'
        ).on(table.accommodationId, table.platform)
    })
);

export const accommodationExternalListingsRelations = relations(
    accommodationExternalListings,
    ({ one, many }) => ({
        accommodation: one(accommodations, {
            fields: [accommodationExternalListings.accommodationId],
            references: [accommodations.id]
        }),
        createdBy: one(users, {
            fields: [accommodationExternalListings.createdById],
            references: [users.id],
            relationName: 'accommodationExternalListingCreatedBy'
        }),
        updatedBy: one(users, {
            fields: [accommodationExternalListings.updatedById],
            references: [users.id],
            relationName: 'accommodationExternalListingUpdatedBy'
        }),
        deletedBy: one(users, {
            fields: [accommodationExternalListings.deletedById],
            references: [users.id],
            relationName: 'accommodationExternalListingDeletedBy'
        }),
        reputation: many(accommodationExternalReputation)
    })
);

/** Type inferred from the Drizzle schema for SELECT operations. */
export type SelectAccommodationExternalListing = typeof accommodationExternalListings.$inferSelect;

/** Type inferred from the Drizzle schema for INSERT operations. */
export type InsertAccommodationExternalListing = typeof accommodationExternalListings.$inferInsert;

// Domain type alias — matches the Zod schema in @repo/schemas.
export type { AccommodationExternalListing };

import type { AccommodationExternalReputation, ExternalReviewSnippet } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import {
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { ExternalPlatformPgEnum, ExternalReputationFetchStatusPgEnum } from '../enums.dbschema.ts';
import { accommodationExternalListings } from './accommodation_external_listings.dbschema.ts';

/**
 * Table caching reputation data fetched from external platforms.
 * One row per (accommodation, platform) — updated by the background fetcher job.
 *
 * This table intentionally omits the standard BaseAuditFields / BaseLifecycleFields
 * because it is purely cache-managed (no owner/admin writes, no soft-delete workflow,
 * no moderation gate). Only `createdAt` and `updatedAt` are tracked for cache-age
 * purposes. See AccommodationExternalReputationSchema in @repo/schemas for details.
 */
export const accommodationExternalReputation = pgTable(
    'accommodation_external_reputation',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** FK to the accommodation whose reputation this row caches. */
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        /** Platform from which this reputation data was fetched. */
        platform: ExternalPlatformPgEnum('platform').notNull(),
        /**
         * FK to the accommodation_external_listings row that provided the
         * externalId / URL used for the fetch.
         */
        listingId: uuid('listing_id')
            .notNull()
            .references(() => accommodationExternalListings.id, { onDelete: 'cascade' }),
        /**
         * Overall numeric rating as returned by the platform (e.g. 4.7 on 1-5).
         * Stored as NUMERIC(3,2) — max value 9.99 covers all common scales.
         * Drizzle mode:'number' ensures the value is a JS number at runtime.
         */
        rating: numeric('rating', { precision: 3, scale: 2, mode: 'number' }),
        /** Total number of reviews as returned by the platform. */
        reviewsCount: integer('reviews_count'),
        /**
         * Deep link to the listing reviews section on the platform.
         * Used when the listing has showLink = true.
         */
        deepLink: text('deep_link'),
        /**
         * Up to N most recent / most relevant review snippets fetched from the
         * platform, stored as JSONB. Null when the platform does not support
         * snippet fetching or the last fetch was not 'ok'.
         */
        snippets: jsonb('snippets').$type<ExternalReviewSnippet[]>(),
        /** Timestamp of the last successful snippet fetch. */
        snippetsFetchedAt: timestamp('snippets_fetched_at', { withTimezone: true }),
        /** Timestamp of the last successful aggregate (rating + reviewsCount) fetch. */
        aggregateFetchedAt: timestamp('aggregate_fetched_at', { withTimezone: true }),
        /** Outcome of the most recent fetch attempt. Defaults to 'ok' on first insert. */
        fetchStatus: ExternalReputationFetchStatusPgEnum('fetch_status').notNull().default('ok'),
        /**
         * Human-readable diagnostic message from the last fetch attempt.
         * Populated on non-ok statuses to aid debugging.
         */
        fetchMessage: text('fetch_message'),
        /** Row creation timestamp (set by the DB on first upsert). */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        /** Timestamp of the last upsert (updated on every fetch run). */
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** Index for FK lookup — all cached reputations for a given accommodation. */
        accommodation_external_reputation_accommodationId_idx: index(
            'accommodation_external_reputation_accommodationId_idx'
        ).on(table.accommodationId),
        /** Index for listing FK lookup. */
        accommodation_external_reputation_listingId_idx: index(
            'accommodation_external_reputation_listingId_idx'
        ).on(table.listingId),
        /** Index for platform-scoped queries (e.g. "all GOOGLE reputations"). */
        accommodation_external_reputation_platform_idx: index(
            'accommodation_external_reputation_platform_idx'
        ).on(table.platform),
        /**
         * Unique constraint: one cached reputation per (accommodation, platform).
         * This is the ON CONFLICT target used by upsertReputation() in the model.
         */
        accommodation_external_reputation_accommodation_platform_uniq: uniqueIndex(
            'accommodation_external_reputation_accommodation_platform_uniq'
        ).on(table.accommodationId, table.platform)
    })
);

export const accommodationExternalReputationRelations = relations(
    accommodationExternalReputation,
    ({ one }) => ({
        accommodation: one(accommodations, {
            fields: [accommodationExternalReputation.accommodationId],
            references: [accommodations.id]
        }),
        listing: one(accommodationExternalListings, {
            fields: [accommodationExternalReputation.listingId],
            references: [accommodationExternalListings.id]
        })
    })
);

/** Type inferred from the Drizzle schema for SELECT operations. */
export type SelectAccommodationExternalReputation =
    typeof accommodationExternalReputation.$inferSelect;

/** Type inferred from the Drizzle schema for INSERT operations. */
export type InsertAccommodationExternalReputation =
    typeof accommodationExternalReputation.$inferInsert;

// Domain type alias — matches the Zod schema in @repo/schemas.
export type { AccommodationExternalReputation };

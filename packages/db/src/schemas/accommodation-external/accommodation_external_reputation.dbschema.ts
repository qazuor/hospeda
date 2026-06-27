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
import {
    ExternalPlatformPgEnum,
    ExternalReputationFetchStatusPgEnum,
    ExternalReputationRunStatusPgEnum
} from '../enums.dbschema.ts';
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
         * Overall numeric rating as returned by the platform (e.g. 4.7 on 1-5 or
         * 8.7 on a 1-10 scale such as Booking.com).
         * Stored as NUMERIC(4,2) — max value 99.99 safely covers all common scales
         * including Booking's 1–10 range (widened from NUMERIC(3,2) which overflowed
         * at 10.00 — FIX L4).
         * Drizzle mode:'number' ensures the value is a JS number at runtime.
         */
        rating: numeric('rating', { precision: 4, scale: 2, mode: 'number' }),
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
        /**
         * Async run status for Apify-backed platforms.
         * Tracks the lifecycle of an asynchronous Apify run (idle → pending → running → idle).
         * Separate from fetchStatus so the public block builder never sees transient run state.
         * Defaults to 'idle' (no run in progress).
         */
        runStatus: ExternalReputationRunStatusPgEnum('run_status').notNull().default('idle'),
        /**
         * Apify run ID returned by POST /v2/acts/{actor}/runs.
         * Set when run_status = 'pending'; cleared to null after the run resolves.
         */
        apifyRunId: text('apify_run_id'),
        /**
         * Default dataset ID for the Apify run (returned when the run succeeds).
         * Set by the polling cron before fetching dataset items; cleared on resolution.
         */
        apifyDatasetId: text('apify_dataset_id'),
        /**
         * Wall-clock time when startRun() was called.
         * Used by the timeout sweep: if now() - run_started_at > HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS
         * the poller marks the row as error and resets run_status to 'idle'.
         */
        runStartedAt: timestamp('run_started_at', { withTimezone: true }),
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
        ).on(table.accommodationId, table.platform),
        /**
         * Index on run_status for the polling cron's WHERE run_status IN ('pending','running').
         * The table may grow to thousands of rows; this keeps the poller's SELECT fast.
         */
        accommodation_external_reputation_runStatus_idx: index(
            'accommodation_external_reputation_runStatus_idx'
        ).on(table.runStatus)
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

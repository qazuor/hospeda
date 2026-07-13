import { relations } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { CalendarSyncStatusPgEnum, OccupancySourcePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodations } from './accommodation.dbschema.ts';

/**
 * `accommodation_calendar_sync` — one row per external calendar connection
 * for an accommodation (HOS-157 Phase 2 — Google Calendar sync).
 *
 * `provider` REUSES `OccupancySourcePgEnum` (the same enum backing
 * `accommodation_occupancy.source`) rather than introducing a new
 * provider-specific enum — Phase 2 only ever writes `GOOGLE_CALENDAR` rows
 * here; Phase 3 (Airbnb/Booking iCal sync) is expected to reuse this same
 * table with `AIRBNB`/`BOOKING` provider values.
 *
 * The `access_token_*`/`refresh_token_*` columns store OPAQUE ciphertext.
 * This table (and the model built on top of it) has NO knowledge of the
 * encryption scheme — encrypting/decrypting these secrets is the exclusive
 * responsibility of apps/api's OAuth vault, mirroring
 * `external_oauth_credentials.dbschema.ts`'s triplet shape (ciphertext + iv +
 * authTag per secret).
 *
 * Unique on `(accommodation_id, provider)`: one connection row per provider
 * per accommodation (an accommodation can have at most one active Google
 * Calendar connection at a time; reconnecting re-uses the same row via
 * `upsertConnection`'s `onConflictDoUpdate`).
 *
 * No `deletedAt` — disconnecting is either `deactivate()` (soft, keeps the
 * row for audit with `isActive=false`) or `deleteConnection()` (hard
 * delete), both exposed by the model. There is no soft-delete lifecycle
 * column on this table.
 */
export const accommodationCalendarSync = pgTable(
    'accommodation_calendar_sync',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),

        /**
         * Origin of this connection. Reuses `occupancy_source_enum` — Phase 2
         * always writes `GOOGLE_CALENDAR` here.
         */
        provider: OccupancySourcePgEnum('provider').notNull(),

        /**
         * The external Google Calendar id (e.g. `'primary'`, or a specific
         * shared calendar id). `null` before the first successful connect
         * handshake.
         */
        externalCalendarId: varchar('external_calendar_id', { length: 255 }),

        /**
         * Google Calendar API incremental sync token (`nextSyncToken`).
         * `null` until the first full sync completes.
         */
        syncToken: text('sync_token'),

        /** Timestamp of the most recent sync attempt (success or failure). */
        lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),

        /** Outcome of the most recent sync attempt. */
        lastSyncStatus: CalendarSyncStatusPgEnum('last_sync_status').default('PENDING').notNull(),

        /** Error detail from the most recent failed sync attempt, if any. */
        lastErrorMessage: text('last_error_message'),

        /**
         * Whether this connection is currently active. `false` after
         * `deactivate()` (disconnect while keeping the row for audit).
         */
        isActive: boolean('is_active').default(true).notNull(),

        /**
         * AES-256-GCM ciphertext (base64-encoded) of the OAuth access token.
         * Opaque to this schema — encrypted/decrypted by apps/api's OAuth
         * vault, never by this model.
         */
        accessTokenCiphertext: text('access_token_ciphertext').notNull(),

        /**
         * AES-256-GCM initialisation vector (base64-encoded) for the access
         * token. Unique per encryption operation — never reused.
         */
        accessTokenIv: varchar('access_token_iv', { length: 64 }).notNull(),

        /**
         * AES-256-GCM authentication tag (base64-encoded) for the access
         * token. Used to verify ciphertext integrity and authenticity on
         * decrypt.
         */
        accessTokenAuthTag: varchar('access_token_auth_tag', { length: 64 }).notNull(),

        /**
         * AES-256-GCM ciphertext (base64-encoded) of the OAuth refresh
         * token. Nullable — some OAuth flows (or re-connect without a fresh
         * consent) may not return a new refresh token.
         */
        refreshTokenCiphertext: text('refresh_token_ciphertext'),

        /**
         * AES-256-GCM initialisation vector (base64-encoded) for the refresh
         * token.
         */
        refreshTokenIv: varchar('refresh_token_iv', { length: 64 }),

        /**
         * AES-256-GCM authentication tag (base64-encoded) for the refresh
         * token.
         */
        refreshTokenAuthTag: varchar('refresh_token_auth_tag', { length: 64 }),

        /** OAuth scope(s) granted for this connection, as reported by Google. */
        tokenScope: text('token_scope'),

        /**
         * Access token expiry timestamp, as reported by Google's OAuth token
         * response.
         */
        tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),

        /** The actor (host or system) that created this connection. */
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // One connection row per provider per accommodation.
        accommodationCalendarSync_accommodationId_provider_uq: uniqueIndex(
            'accommodationCalendarSync_accommodationId_provider_uq'
        ).on(table.accommodationId, table.provider)
    })
);

export const accommodationCalendarSyncRelations = relations(
    accommodationCalendarSync,
    ({ one }) => ({
        accommodation: one(accommodations, {
            fields: [accommodationCalendarSync.accommodationId],
            references: [accommodations.id]
        }),
        createdBy: one(users, {
            fields: [accommodationCalendarSync.createdById],
            references: [users.id]
        })
    })
);

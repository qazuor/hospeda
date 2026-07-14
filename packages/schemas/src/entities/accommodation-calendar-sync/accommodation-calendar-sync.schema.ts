import { z } from 'zod';
import {
    AccommodationCalendarSyncIdSchema,
    AccommodationIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { CalendarSyncStatusEnumSchema } from '../../enums/calendar-sync-status.schema.js';
import { OccupancySourceEnumSchema } from '../../enums/occupancy-source.schema.js';

/**
 * Core AccommodationCalendarSync entity schema — one row per external
 * calendar connection for an accommodation (HOS-157 Phase 2).
 *
 * Maps 1-to-1 to the `accommodation_calendar_sync` table columns. This is the
 * FULL row shape, including the encrypted OAuth token columns — it is for
 * INTERNAL use only (model/service layer). Never serialize this schema
 * directly into an HTTP response; use {@link AccommodationCalendarSyncStatusSchema}
 * for anything public/protected-facing.
 *
 * - `provider` reuses `OccupancySourceEnumSchema` (the same enum backing
 *   `accommodation_occupancy.source`) rather than a new provider enum.
 *   Phase 2 only ever writes `GOOGLE_CALENDAR` rows here; Phase 3 (Airbnb/
 *   Booking iCal) is expected to reuse the same table with `AIRBNB`/`BOOKING`.
 * - The `accessToken*`/`refreshToken*` columns store OPAQUE ciphertext — this
 *   schema (and the model/table it backs) never encrypts or decrypts. That is
 *   the exclusive responsibility of the API layer's OAuth vault, which reads/
 *   writes these columns as already-encrypted strings.
 * - No `deletedAt` — disconnecting a provider is either `deactivate()`
 *   (soft, `isActive=false`, row kept for audit) or `deleteConnection()`
 *   (hard delete), both exposed by the model. There is no soft-delete
 *   lifecycle column on this table.
 */
export const AccommodationCalendarSyncSchema = z.object({
    id: AccommodationCalendarSyncIdSchema,

    accommodationId: AccommodationIdSchema,

    /**
     * Origin of this connection. Reuses `OccupancySourceEnumSchema` — Phase 2
     * always writes `GOOGLE_CALENDAR` here.
     */
    provider: OccupancySourceEnumSchema,

    /**
     * The external Google Calendar id (e.g. `'primary'`, or a specific shared
     * calendar id). `null` before the first successful connect handshake.
     */
    externalCalendarId: z
        .string({ message: 'zodError.accommodationCalendarSync.externalCalendarId.required' })
        .max(255, { message: 'zodError.accommodationCalendarSync.externalCalendarId.max' })
        .nullable(),

    /**
     * Google Calendar API incremental sync token (`nextSyncToken`). `null`
     * until the first full sync completes; opaque to this schema.
     */
    syncToken: z.string().nullable(),

    /** Timestamp of the most recent sync attempt (success or failure). */
    lastSyncAt: z.coerce.date().nullable(),

    /** Outcome of the most recent sync attempt. Defaults to `PENDING`. */
    lastSyncStatus: CalendarSyncStatusEnumSchema,

    /** Error detail from the most recent failed sync attempt, if any. */
    lastErrorMessage: z.string().nullable(),

    /**
     * Whether this connection is currently active. `false` after
     * `deactivate()` (disconnect while keeping the row for audit).
     */
    isActive: z.boolean({ message: 'zodError.accommodationCalendarSync.isActive.required' }),

    /** AES-256-GCM ciphertext (base64) of the OAuth access token. Opaque. */
    accessTokenCiphertext: z.string({
        message: 'zodError.accommodationCalendarSync.accessTokenCiphertext.required'
    }),

    /** AES-256-GCM initialisation vector (base64) for the access token. */
    accessTokenIv: z.string({
        message: 'zodError.accommodationCalendarSync.accessTokenIv.required'
    }),

    /** AES-256-GCM authentication tag (base64) for the access token. */
    accessTokenAuthTag: z.string({
        message: 'zodError.accommodationCalendarSync.accessTokenAuthTag.required'
    }),

    /** AES-256-GCM ciphertext (base64) of the OAuth refresh token, if any. */
    refreshTokenCiphertext: z.string().nullable(),

    /** AES-256-GCM initialisation vector (base64) for the refresh token. */
    refreshTokenIv: z.string().nullable(),

    /** AES-256-GCM authentication tag (base64) for the refresh token. */
    refreshTokenAuthTag: z.string().nullable(),

    /** OAuth scope(s) granted for this connection, as reported by Google. */
    tokenScope: z.string().nullable(),

    /** Access token expiry timestamp, as reported by Google's OAuth response. */
    tokenExpiresAt: z.coerce.date().nullable(),

    /** The actor (host or system) that created this connection. */
    createdById: UserIdSchema,

    createdAt: z.coerce.date({
        message: 'zodError.accommodationCalendarSync.createdAt.required'
    }),
    updatedAt: z.coerce.date({
        message: 'zodError.accommodationCalendarSync.updatedAt.required'
    })
});

/**
 * TypeScript type for a stored accommodation calendar sync row, inferred
 * from {@link AccommodationCalendarSyncSchema}.
 */
export type AccommodationCalendarSync = z.infer<typeof AccommodationCalendarSyncSchema>;

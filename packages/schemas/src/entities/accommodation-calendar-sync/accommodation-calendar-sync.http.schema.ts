import { z } from 'zod';
import { CalendarSyncStatusEnumSchema } from '../../enums/calendar-sync-status.schema.js';
import { OccupancySourceEnumSchema } from '../../enums/occupancy-source.schema.js';
import { AccommodationCalendarSyncStatusSchema } from './accommodation-calendar-sync-status.schema.js';

/**
 * API request/response schemas for the accommodation calendar-sync routes
 * (`/api/v1/protected/accommodations/{id}/calendar-sync/*`).
 *
 * Covers both the Google Calendar OAuth flow (HOS-157 Phase 2, `connect-google`
 * request body schemas live inline in that route file — pre-existing, out of
 * scope here) and the iCal feed flow (HOS-162 Phase 3: `connect-ical`,
 * `sync`, `status`, `disconnect`).
 */

// ---------------------------------------------------------------------------
// Provider tokens (public path/body values, NOT the internal OccupancySourceEnum)
// ---------------------------------------------------------------------------

/**
 * Public provider token accepted by `connect-ical` — excludes `google`
 * (OAuth-only, handled by the separate `connect-google` flow) and `manual`
 * (host-toggled, no connection row).
 */
export const IcalProviderTokenSchema = z.enum(['airbnb', 'booking', 'other'], {
    message: 'zodError.accommodationCalendarSync.icalProviderToken.invalid'
});

/** TypeScript type for {@link IcalProviderTokenSchema}. */
export type IcalProviderToken = z.infer<typeof IcalProviderTokenSchema>;

/**
 * Public provider token accepted by the widened `disconnect` route — every
 * connectable provider (Google OAuth + the three iCal feed providers).
 */
export const CalendarProviderTokenSchema = z.enum(['google', 'airbnb', 'booking', 'other'], {
    message: 'zodError.accommodationCalendarSync.calendarProviderToken.invalid'
});

/** TypeScript type for {@link CalendarProviderTokenSchema}. */
export type CalendarProviderToken = z.infer<typeof CalendarProviderTokenSchema>;

// ---------------------------------------------------------------------------
// POST /{id}/calendar-sync/connect-ical
// ---------------------------------------------------------------------------

/**
 * Request body for `POST /{id}/calendar-sync/connect-ical`. `feedUrl` must be
 * a well-formed HTTPS URL — the route probes it live before persisting, and
 * `safeExternalFetch` (used by the probe) additionally rejects any non-HTTPS
 * scheme at fetch time, so this is defense-in-depth, not the only guard.
 */
export const ConnectIcalBodySchema = z.object({
    /** The iCal source platform (`airbnb`, `booking`.com, or `other` for a generic feed). */
    provider: IcalProviderTokenSchema,

    /** The `.ics` feed URL to connect. Must be HTTPS. */
    feedUrl: z
        .string({ message: 'zodError.accommodationCalendarSync.feedUrl.required' })
        .url({ message: 'zodError.accommodationCalendarSync.feedUrl.invalid' })
        .startsWith('https://', {
            message: 'zodError.accommodationCalendarSync.feedUrl.httpsRequired'
        })
        .max(2048, { message: 'zodError.accommodationCalendarSync.feedUrl.max' })
});

/** TypeScript type for {@link ConnectIcalBodySchema}. */
export type ConnectIcalBody = z.infer<typeof ConnectIcalBodySchema>;

/**
 * Response for `POST /{id}/calendar-sync/connect-ical` — the resulting single
 * connection's safe status projection, same shape the legacy single-provider
 * `GET .../status` route used to return.
 */
export const CalendarConnectionResponseSchema = z.object({
    /** Whether the newly-established connection is active. Always `true` on a successful connect. */
    connected: z.boolean(),
    /** The safe status projection for the connection just created. */
    status: AccommodationCalendarSyncStatusSchema.nullable()
});

/** TypeScript type for {@link CalendarConnectionResponseSchema}. */
export type CalendarConnectionResponse = z.infer<typeof CalendarConnectionResponseSchema>;

// ---------------------------------------------------------------------------
// GET /{id}/calendar-sync/status (multi-provider, HOS-162 Phase 3)
// ---------------------------------------------------------------------------

/**
 * One provider's connection state, as returned inside the multi-provider
 * `GET .../status` response array. Every token/secret column is stripped —
 * same safety guarantee as {@link AccommodationCalendarSyncStatusSchema}, just
 * reshaped for a list instead of a single nullable object.
 */
export const CalendarProviderConnectionSchema = z.object({
    /** Which provider this row describes (`GOOGLE_CALENDAR`, `AIRBNB`, `BOOKING`, or `OTHER`). */
    provider: OccupancySourceEnumSchema,
    /** Whether this connection is currently active. */
    connected: z.boolean(),
    /** Timestamp of the most recent sync attempt (success or failure), if any. */
    lastSyncAt: z.coerce.date().nullable(),
    /** Outcome of the most recent sync attempt. */
    lastSyncStatus: CalendarSyncStatusEnumSchema,
    /** Error detail from the most recent failed sync attempt, if any. */
    lastErrorMessage: z.string().nullable()
});

/** TypeScript type for {@link CalendarProviderConnectionSchema}. */
export type CalendarProviderConnection = z.infer<typeof CalendarProviderConnectionSchema>;

/**
 * Response for `GET /{id}/calendar-sync/status` (widened, HOS-162 Phase 3) —
 * one row per provider the accommodation has EVER connected (active or
 * soft-disconnected), so a host can see and clean up a stale connection even
 * after losing the sync entitlement. A provider the host never connected is
 * simply absent from the array (no `connected: false` placeholder row).
 */
export const CalendarSyncStatusListResponseSchema = z.object({
    connections: z.array(CalendarProviderConnectionSchema)
});

/** TypeScript type for {@link CalendarSyncStatusListResponseSchema}. */
export type CalendarSyncStatusListResponse = z.infer<typeof CalendarSyncStatusListResponseSchema>;

// ---------------------------------------------------------------------------
// DELETE /{id}/calendar-sync/{provider}
// ---------------------------------------------------------------------------

/** Response for `DELETE /{id}/calendar-sync/{provider}`. */
export const CalendarDisconnectResponseSchema = z.object({
    /** Whether a connection row existed and was soft-disconnected. */
    disconnected: z.boolean()
});

/** TypeScript type for {@link CalendarDisconnectResponseSchema}. */
export type CalendarDisconnectResponse = z.infer<typeof CalendarDisconnectResponseSchema>;

// ---------------------------------------------------------------------------
// POST /{id}/calendar-sync/sync (widened, HOS-162 Phase 3)
// ---------------------------------------------------------------------------

/**
 * Request body for `POST /{id}/calendar-sync/sync` (widened, HOS-162 Phase
 * 3). `provider` is OPTIONAL and defaults to `google` when omitted —
 * preserving the exact pre-Phase-3 contract (an empty/no body synced Google)
 * so the existing web client keeps working unchanged until Phase F adds
 * provider selection to the UI.
 */
export const SyncCalendarBodySchema = z.object({
    /** Which provider to sync. Defaults to `google` when omitted (backward-compatible). */
    provider: CalendarProviderTokenSchema.optional()
});

/** TypeScript type for {@link SyncCalendarBodySchema}. */
export type SyncCalendarBody = z.infer<typeof SyncCalendarBodySchema>;

/**
 * Response for `POST /{id}/calendar-sync/sync` — a discriminated union
 * covering both the Google Calendar sync service's result shape and the
 * iCal sync service's result shape. `ok` merges both providers' success
 * fields as optional (Google reports `eventsProcessed`/`datesUpserted`/
 * `datesRemoved`/`fullSync`; iCal reports `removed`/`inserted`) rather than
 * two same-discriminant variants, which `z.discriminatedUnion` disallows.
 */
export const CalendarSyncResultSchema = z.discriminatedUnion('status', [
    z.object({
        status: z.literal('ok'),
        eventsProcessed: z.number().optional(),
        datesUpserted: z.number().optional(),
        datesRemoved: z.number().optional(),
        fullSync: z.boolean().optional(),
        removed: z.number().optional(),
        inserted: z.number().optional()
    }),
    z.object({
        status: z.literal('skipped'),
        reason: z.string()
    }),
    z.object({
        status: z.literal('error'),
        kind: z.enum([
            'terminal',
            'transient',
            'api',
            'unknown',
            'fetch_error',
            'parse_error',
            'empty'
        ]),
        message: z.string()
    })
]);

/** TypeScript type for {@link CalendarSyncResultSchema}. */
export type CalendarSyncResult = z.infer<typeof CalendarSyncResultSchema>;

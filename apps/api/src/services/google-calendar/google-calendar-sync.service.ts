/**
 * Google Calendar occupancy sync service (HOS-157 Phase 2 — Layer 3).
 *
 * Orchestrates one sync run for a single accommodation's Google Calendar
 * connection as a DECLARATIVE full-window reconcile:
 *
 * 1. Fetch ALL live events from start-of-today forward (a bounded full fetch —
 *    no incremental syncToken).
 * 2. Compute the DESIRED set of blocked dates: map every non-cancelled event to
 *    the dates it occupies and collapse them to one entry per date (first event
 *    to cover a date wins its provenance).
 * 3. Atomically REPLACE all future `source = GOOGLE_CALENDAR` occupancy rows
 *    with that desired set via a single transaction — WITHOUT ever touching
 *    `MANUAL` rows (the model primitive is `source`-scoped and inserts with
 *    `ON CONFLICT DO NOTHING`, so MANUAL wins any shared date).
 *
 * ## Why declarative (and why incremental syncToken was dropped)
 *
 * The `accommodation_occupancy` table has a UNIQUE index on
 * `(accommodationId, date)` ONLY — there is at most one row per day regardless
 * of source. Correct overlap handling under that model is impossible per-event:
 * two overlapping events sharing a date, one of which is deleted, must leave the
 * day blocked as long as EITHER is still live. Reconciling by DATE from the full
 * live event set is the only way to get that right. The prior per-event
 * imperative reconcile (delete-by-external-event-id) could free a date another
 * live event still covered → double-booking; it also silently deleted past
 * occupancy and did N+1 DB round trips.
 *
 * Incremental syncToken sync is therefore intentionally NOT used: correctly
 * recomputing the desired date set requires the full event set anyway, and a
 * bounded full fetch every ~6h is cheap at this scale. The `syncToken` column is
 * no longer read or written by this service.
 *
 * ## Event → dates mapping (the "≥1 day" rule)
 *
 * An event occupies the half-open date range `[startDate, endDate)`:
 * - All-day events expose `start.date` / `end.date`, where Google's `end.date`
 *   is already EXCLUSIVE — so a Jul-10→Jul-12 all-day event blocks Jul-10 and
 *   Jul-11, leaving the checkout day (Jul-12) free. This matches the hotel
 *   "checkout day is free" semantics the occupancy search filter uses.
 * - Timed events expose `start.dateTime` / `end.dateTime` (RFC3339). The
 *   Calendar API is asked to return these normalized to {@link SYNC_RESPONSE_TIMEZONE}
 *   (the AR market zone), so the wall-clock date is deterministically the
 *   `YYYY-MM-DD` prefix regardless of the calendar's own zone; the end date is
 *   likewise treated as an EXCLUSIVE checkout day.
 *
 * The half-open range naturally implements the spec's "events ≥1 day →
 * occupancy" rule: a same-day timed event has `startDate == endDate`, yielding
 * an EMPTY range, so it creates no occupancy. No separate duration branch is
 * needed.
 *
 * ## Failure handling
 *
 * This service never throws for operational failures — it records the outcome
 * on the connection's sync-state columns (`lastSyncStatus` OK/ERROR,
 * `lastErrorMessage`, `lastSyncAt`) and returns a discriminated
 * {@link CalendarSyncResult}. That keeps the cron loop (Layer 4) simple: it
 * calls this per active connection and moves on. A `401`/`403` from the Calendar
 * API means the host revoked the grant at Google — classified `terminal` and
 * recorded as ERROR so the host UI can prompt a reconnect.
 *
 * @module services/google-calendar/google-calendar-sync.service
 */

import { accommodationCalendarSyncModel, accommodationOccupancyModel } from '@repo/db';
import { CalendarSyncStatusEnum, OccupancySourceEnum } from '@repo/schemas';
import { apiLogger } from '../../utils/logger.js';
import {
    enumerateHalfOpenDates,
    MAX_EVENT_DAYS,
    markerToDate
} from '../calendar-sync/date-range.js';
import {
    GoogleCalendarApiError,
    type GoogleCalendarEvent,
    listEvents
} from './google-calendar-client.js';
import { getGoogleCredential } from './google-calendar-credential.repository.js';
import { GoogleTokenRefreshError } from './google-token.errors.js';
import { getValidGoogleToken } from './google-token.service.js';

/** The provider value for every Google Calendar row. */
const PROVIDER = OccupancySourceEnum.GOOGLE_CALENDAR;

/**
 * IANA timezone requested from the Calendar API so every timed event's
 * `dateTime` is returned normalized to the Argentine market zone. This makes
 * the date a timed event maps to DETERMINISTIC (the `YYYY-MM-DD` prefix is
 * always the AR wall-clock date), regardless of the connected calendar's own
 * default zone. All-day events carry pure `date` values and are unaffected.
 *
 * Hardcoded because the platform targets the AR market (Litoral) and
 * accommodations carry no per-property timezone. Revisit (env var or a
 * per-accommodation zone) only if non-AR accommodations are onboarded.
 */
const SYNC_RESPONSE_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Outcome of a single {@link syncAccommodationCalendar} run.
 */
export type CalendarSyncResult =
    | {
          readonly status: 'ok';
          /** Number of calendar events examined this run. */
          readonly eventsProcessed: number;
          /** Number of occupancy rows inserted this run. */
          readonly datesUpserted: number;
          /** Number of occupancy rows removed this run (replaced future rows). */
          readonly datesRemoved: number;
          /** Whether this run was a full sync (always `true` — see module doc). */
          readonly fullSync: boolean;
      }
    | {
          readonly status: 'skipped';
          /** Why the run was skipped (no connection / inactive / no calendar id). */
          readonly reason: string;
      }
    | {
          readonly status: 'error';
          /** Classifies the failure for the caller (retryable vs actionable). */
          readonly kind: 'terminal' | 'transient' | 'api' | 'unknown';
          /** Human-readable failure detail (also stored on the connection). */
          readonly message: string;
      };

/**
 * Maps a non-cancelled event to the set of dates it occupies. Returns an empty
 * array when the event has no usable start/end or is shorter than one day.
 *
 * Uses the shared provider-agnostic {@link markerToDate} /
 * {@link enumerateHalfOpenDates} helpers (`../calendar-sync/date-range.js`) —
 * `event.start`/`event.end` structurally satisfy `DateOrDateTimeMarker`. The
 * `YYYY-MM-DD` extraction from a timed marker's `dateTime` prefix is
 * deterministic here specifically because {@link SYNC_RESPONSE_TIMEZONE} is
 * requested from the Calendar API (Google normalizes timed events to that
 * zone at the API layer).
 *
 * Emits a WARN when the event's date range hits {@link MAX_EVENT_DAYS} — a
 * pathological span whose occupancy is truncated at the cap.
 *
 * @param event - A Google Calendar event.
 * @param accommodationId - The accommodation being synced (for cap-hit logging).
 * @returns The `YYYY-MM-DD` dates the event blocks.
 */
const mapEventToDates = (event: GoogleCalendarEvent, accommodationId?: string): string[] => {
    const startDate = markerToDate(event.start);
    const endDate = markerToDate(event.end);
    if (startDate === undefined || endDate === undefined) {
        return [];
    }
    const dates = enumerateHalfOpenDates(startDate, endDate);
    if (dates.length === MAX_EVENT_DAYS) {
        apiLogger.warn(
            {
                ...(accommodationId === undefined ? {} : { accommodationId }),
                externalEventId: event.id,
                cappedAt: MAX_EVENT_DAYS
            },
            'google-calendar-sync: event date range hit the cap; occupancy truncated'
        );
    }
    return dates;
};

/**
 * One page-following FULL fetch of all events for a calendar from `timeMin`
 * forward, accumulating items across pages.
 *
 * @param params.accessToken - A valid Google access token.
 * @param params.calendarId - The calendar to read.
 * @param params.timeMin - Full-sync lower bound (RFC3339).
 * @returns All events fetched across every page.
 * @throws {GoogleCalendarApiError} On any non-2xx response.
 */
const fetchAllPages = async (params: {
    accessToken: string;
    calendarId: string;
    timeMin: string;
}): Promise<{ events: GoogleCalendarEvent[] }> => {
    const { accessToken, calendarId, timeMin } = params;
    const events: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
        const page = await listEvents({
            accessToken,
            calendarId,
            timeZone: SYNC_RESPONSE_TIMEZONE,
            timeMin,
            ...(pageToken === undefined ? {} : { pageToken })
        });
        events.push(...page.items);
        pageToken = page.nextPageToken;
    } while (pageToken !== undefined);

    return { events };
};

/**
 * Records a failed sync on the connection's sync-state columns and returns the
 * matching error result. Never throws.
 *
 * @param accommodationId - The accommodation whose sync failed.
 * @param kind - Failure classification for the caller.
 * @param message - Human-readable failure detail.
 * @returns The `error` {@link CalendarSyncResult}.
 */
const recordFailure = async (
    accommodationId: string,
    kind: 'terminal' | 'transient' | 'api' | 'unknown',
    message: string
): Promise<CalendarSyncResult> => {
    try {
        await accommodationCalendarSyncModel.updateSyncState({
            accommodationId,
            provider: PROVIDER,
            lastSyncAt: new Date(),
            lastSyncStatus: CalendarSyncStatusEnum.ERROR,
            lastErrorMessage: message
        });
    } catch (persistError) {
        apiLogger.error(
            {
                accommodationId,
                error: persistError instanceof Error ? persistError.message : String(persistError)
            },
            'google-calendar-sync: failed to persist ERROR sync state'
        );
    }
    return { status: 'error', kind, message };
};

/**
 * Runs one Google Calendar → occupancy sync for a single accommodation as a
 * declarative full-window reconcile (see module doc).
 *
 * @param params.accommodationId - The accommodation whose connection to sync.
 * @returns A discriminated {@link CalendarSyncResult}. Never throws for
 * operational failures — the outcome is also persisted on the connection.
 *
 * @example
 * ```ts
 * const result = await syncAccommodationCalendar({ accommodationId });
 * if (result.status === 'error') { // host may need to reconnect
 * }
 * ```
 */
export const syncAccommodationCalendar = async (params: {
    accommodationId: string;
}): Promise<CalendarSyncResult> => {
    const { accommodationId } = params;

    const credential = await getGoogleCredential({ accommodationId });
    if (credential === null) {
        return { status: 'skipped', reason: 'no-connection' };
    }
    if (!credential.isActive) {
        return { status: 'skipped', reason: 'inactive' };
    }
    if (credential.externalCalendarId === null) {
        return { status: 'skipped', reason: 'no-calendar-id' };
    }

    const calendarId = credential.externalCalendarId;

    // 1. Obtain a valid access token (refreshes transparently).
    let accessToken: string;
    try {
        accessToken = await getValidGoogleToken({ accommodationId });
    } catch (error) {
        if (error instanceof GoogleTokenRefreshError) {
            return recordFailure(accommodationId, error.kind, error.message);
        }
        return recordFailure(
            accommodationId,
            'unknown',
            error instanceof Error ? error.message : String(error)
        );
    }

    // 2. Compute the reconcile window ONCE: start-of-today forward, in the AR
    //    market zone (NOT UTC) so `fromDate` is consistent with how event dates
    //    are extracted (both in SYNC_RESPONSE_TIMEZONE). Using UTC here would,
    //    during the ~3h UTC-vs-AR daily overlap, place `fromDate` a day ahead of
    //    an event's AR date and let a past date slip through. AR is a fixed
    //    UTC-3 offset (no DST since 2009).
    const fromDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: SYNC_RESPONSE_TIMEZONE
    }).format(new Date());
    const timeMin = new Date(`${fromDate}T00:00:00-03:00`).toISOString();

    // 3. FULL fetch of every live event from `timeMin` forward.
    let fetched: { events: GoogleCalendarEvent[] };
    try {
        fetched = await fetchAllPages({ accessToken, calendarId, timeMin });
    } catch (error) {
        if (error instanceof GoogleCalendarApiError) {
            // 401/403 => the grant was revoked at Google; the host must
            // reconnect. Anything else is a retryable API failure.
            const kind = error.status === 401 || error.status === 403 ? 'terminal' : 'api';
            return recordFailure(accommodationId, kind, error.message);
        }
        return recordFailure(
            accommodationId,
            'unknown',
            error instanceof Error ? error.message : String(error)
        );
    }

    // 4. Build the DESIRED blocked-date set: one entry per date, first live
    //    event to cover a date wins its provenance. Overlaps collapse to a
    //    single row that stays blocked as long as EITHER event is live.
    const desired = new Map<string, string>();
    for (const event of fetched.events) {
        if (event.status === 'cancelled') {
            continue;
        }
        for (const date of mapEventToDates(event, accommodationId)) {
            if (!desired.has(date)) {
                desired.set(date, event.id);
            }
        }
    }
    // Clamp to the reconcile window: an in-progress event (started before today,
    // still ongoing) is returned in full by Google (timeMin filters by event END),
    // so its past dates land in `desired`. The model's DELETE only clears
    // `date >= fromDate`, so a past date here would be INSERTED and never cleaned
    // up. Dropping `date < fromDate` keeps the "past rows are never touched"
    // invariant intact on the insert side too.
    const rows = [...desired]
        .filter(([date]) => date >= fromDate)
        .map(([date, externalEventId]) => ({ date, externalEventId }));

    // 5. Atomically replace all future GOOGLE_CALENDAR rows with the desired
    //    set (never touches MANUAL rows).
    let removed: number;
    let inserted: number;
    try {
        ({ removed, inserted } = await accommodationOccupancyModel.replaceFutureSyncOccupancy({
            accommodationId,
            source: PROVIDER,
            fromDate,
            rows,
            createdById: credential.createdById
        }));
    } catch (error) {
        return recordFailure(
            accommodationId,
            'unknown',
            error instanceof Error ? error.message : String(error)
        );
    }

    // 6. Persist success. No syncToken — incremental sync is intentionally
    //    dropped (see module doc).
    await accommodationCalendarSyncModel.updateSyncState({
        accommodationId,
        provider: PROVIDER,
        lastSyncAt: new Date(),
        lastSyncStatus: CalendarSyncStatusEnum.OK,
        lastErrorMessage: null
    });

    return {
        status: 'ok',
        eventsProcessed: fetched.events.length,
        datesUpserted: inserted,
        datesRemoved: removed,
        fullSync: true
    };
};

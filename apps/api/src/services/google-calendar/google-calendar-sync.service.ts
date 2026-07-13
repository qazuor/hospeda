/**
 * Google Calendar occupancy sync service (HOS-157 Phase 2 — Layer 3).
 *
 * Orchestrates one sync run for a single accommodation's Google Calendar
 * connection: fetch events (full or incremental), map each event to the set of
 * dates it occupies, and reconcile the `accommodation_occupancy` rows for
 * `source = GOOGLE_CALENDAR` so they exactly reflect the calendar — WITHOUT
 * ever touching `MANUAL` rows (the model's sync methods are all `source`-scoped
 * by construction).
 *
 * ## Event → dates mapping (the "≥1 day" rule)
 *
 * An event occupies the half-open date range `[startDate, endDate)`:
 * - All-day events expose `start.date` / `end.date`, where Google's `end.date`
 *   is already EXCLUSIVE — so a Jul-10→Jul-12 all-day event blocks Jul-10 and
 *   Jul-11, leaving the checkout day (Jul-12) free. This matches the hotel
 *   "checkout day is free" semantics the occupancy search filter uses.
 * - Timed events expose `start.dateTime` / `end.dateTime` (RFC3339 with the
 *   event's own offset); the wall-clock date is the `YYYY-MM-DD` prefix, and
 *   the end date is likewise treated as an EXCLUSIVE checkout day.
 *
 * The half-open range naturally implements the spec's "events ≥1 day →
 * occupancy" rule: a same-day timed event has `startDate == endDate`, yielding
 * an EMPTY range, so it creates no occupancy. No separate duration branch is
 * needed.
 *
 * ## Full vs incremental + 410 recovery
 *
 * With a stored `syncToken`, an incremental sync is attempted first; Google
 * returns changed AND deleted (`status: 'cancelled'`) events. If the token has
 * expired ({@link GoogleCalendarSyncTokenInvalidError}), the stored token is
 * discarded and a full sync runs. A full sync additionally reconciles ORPHANS —
 * DB rows whose event no longer appears in the calendar at all (deleted while
 * the token was invalid) — which an incremental sync would have caught via an
 * explicit `cancelled` entry.
 *
 * ## Failure handling
 *
 * This service never throws for operational failures — it records the outcome
 * on the connection's sync-state columns (`lastSyncStatus` OK/ERROR,
 * `lastErrorMessage`, `lastSyncAt`) and returns a discriminated
 * {@link CalendarSyncResult}. That keeps the cron loop (Layer 4) simple: it
 * calls this per active connection and moves on. A terminal token failure
 * (host revoked access) is recorded as ERROR so the host UI can prompt a
 * reconnect.
 *
 * @module services/google-calendar/google-calendar-sync.service
 */

import { accommodationCalendarSyncModel, accommodationOccupancyModel } from '@repo/db';
import { CalendarSyncStatusEnum, OccupancySourceEnum } from '@repo/schemas';
import { apiLogger } from '../../utils/logger.js';
import {
    GoogleCalendarApiError,
    type GoogleCalendarEvent,
    GoogleCalendarSyncTokenInvalidError,
    listEvents
} from './google-calendar-client.js';
import { getGoogleCredential } from './google-calendar-credential.repository.js';
import { GoogleTokenRefreshError } from './google-token.errors.js';
import { getValidGoogleToken } from './google-token.service.js';

/** The provider value for every Google Calendar row. */
const PROVIDER = OccupancySourceEnum.GOOGLE_CALENDAR;

/** Milliseconds in a day, for half-open date enumeration. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Defensive cap on the number of days a single event may occupy. Guards against
 * a pathological multi-year event exploding into tens of thousands of rows.
 */
const MAX_EVENT_DAYS = 370;

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
          /** Number of occupancy rows removed this run (stale, cancelled, or orphaned). */
          readonly datesRemoved: number;
          /** Whether this run was a full sync (vs incremental). */
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
 * Extracts the wall-clock `YYYY-MM-DD` date from an event start/end marker.
 * All-day markers expose `date` directly; timed markers expose `dateTime`
 * whose `YYYY-MM-DD` prefix is the local date in the event's own offset.
 *
 * @param marker - The event start or end marker, if present.
 * @returns The `YYYY-MM-DD` date, or `undefined` when the marker is absent/unusable.
 */
const markerToDate = (marker: GoogleCalendarEvent['start']): string | undefined => {
    if (marker === undefined) {
        return undefined;
    }
    if (marker.date !== undefined) {
        return marker.date;
    }
    if (marker.dateTime !== undefined && marker.dateTime.length >= 10) {
        return marker.dateTime.slice(0, 10);
    }
    return undefined;
};

/**
 * Enumerates the half-open `[startDate, endDate)` date range as `YYYY-MM-DD`
 * strings, using UTC date math to avoid any local-timezone drift.
 *
 * Returns an empty array when the range is empty or inverted (`endDate <=
 * startDate`) — this is exactly how same-day / sub-1-day events are excluded.
 *
 * @param startDate - Inclusive lower bound, `YYYY-MM-DD`.
 * @param endDate - Exclusive upper bound, `YYYY-MM-DD`.
 * @returns The occupied dates, capped at {@link MAX_EVENT_DAYS}.
 */
const enumerateHalfOpenDates = (startDate: string, endDate: string): string[] => {
    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    const endMs = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        return [];
    }

    const dates: string[] = [];
    let cursor = startMs;
    while (cursor < endMs && dates.length < MAX_EVENT_DAYS) {
        // Built from a `T00:00:00Z` base, so the ISO date prefix is stable.
        dates.push(new Date(cursor).toISOString().slice(0, 10));
        cursor += DAY_MS;
    }
    return dates;
};

/**
 * Maps a non-cancelled event to the set of dates it occupies. Returns an empty
 * array when the event has no usable start/end or is shorter than one day.
 *
 * @param event - A Google Calendar event.
 * @returns The `YYYY-MM-DD` dates the event blocks.
 */
const mapEventToDates = (event: GoogleCalendarEvent): string[] => {
    const startDate = markerToDate(event.start);
    const endDate = markerToDate(event.end);
    if (startDate === undefined || endDate === undefined) {
        return [];
    }
    return enumerateHalfOpenDates(startDate, endDate);
};

/**
 * One page-following fetch of all events for a calendar, accumulating items
 * across pages and capturing the final `nextSyncToken`.
 *
 * @param params.accessToken - A valid Google access token.
 * @param params.calendarId - The calendar to read.
 * @param params.syncToken - Incremental token, or `undefined` for a full sync.
 * @param params.timeMin - Full-sync lower bound (ignored when `syncToken` is set).
 * @returns All events plus the new sync token (when Google returned one).
 * @throws {GoogleCalendarSyncTokenInvalidError} On a stale sync token (410).
 * @throws {GoogleCalendarApiError} On other non-2xx responses.
 */
const fetchAllPages = async (params: {
    accessToken: string;
    calendarId: string;
    syncToken: string | undefined;
    timeMin: string | undefined;
}): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | undefined }> => {
    const { accessToken, calendarId, syncToken, timeMin } = params;
    const events: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
        const page = await listEvents({
            accessToken,
            calendarId,
            ...(syncToken === undefined ? {} : { syncToken }),
            ...(timeMin === undefined ? {} : { timeMin }),
            ...(pageToken === undefined ? {} : { pageToken })
        });
        events.push(...page.items);
        pageToken = page.nextPageToken;
        if (page.nextSyncToken !== undefined) {
            nextSyncToken = page.nextSyncToken;
        }
    } while (pageToken !== undefined);

    return { events, nextSyncToken };
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
 * Applies one event's reconciliation against the occupancy table: upsert the
 * dates it now covers and delete any stale rows it no longer covers (or, for a
 * cancelled / sub-1-day event, delete all of its rows).
 *
 * @param params.accommodationId - The accommodation being synced.
 * @param params.event - The calendar event.
 * @param params.createdById - Actor to attribute inserted rows to.
 * @returns Counts of rows upserted and removed for this event.
 */
const reconcileEvent = async (params: {
    accommodationId: string;
    event: GoogleCalendarEvent;
    createdById: string;
}): Promise<{ upserted: number; removed: number }> => {
    const { accommodationId, event, createdById } = params;

    if (event.status === 'cancelled') {
        const removed = await accommodationOccupancyModel.deleteByExternalEventId({
            accommodationId,
            source: PROVIDER,
            externalEventId: event.id
        });
        return { upserted: 0, removed };
    }

    const dates = mapEventToDates(event);

    if (dates.length === 0) {
        // The event covers no full day (e.g. shrank to a same-day timed event):
        // remove any occupancy rows it previously created.
        const removed = await accommodationOccupancyModel.deleteByExternalEventId({
            accommodationId,
            source: PROVIDER,
            externalEventId: event.id
        });
        return { upserted: 0, removed };
    }

    const inserted = await accommodationOccupancyModel.upsertSyncOccupancy({
        accommodationId,
        dates,
        source: PROVIDER,
        externalEventId: event.id,
        createdById
    });
    // Reconcile a shrunk range: drop rows for dates the event no longer covers.
    const removed = await accommodationOccupancyModel.deleteStaleSyncByExternalEventId({
        accommodationId,
        source: PROVIDER,
        externalEventId: event.id,
        keepDates: dates
    });

    return { upserted: inserted.length, removed };
};

/**
 * Removes occupancy rows for events that no longer exist in the calendar at
 * all — only meaningful after a FULL sync, where deleted events are simply
 * absent (an incremental sync reports them as `cancelled` instead).
 *
 * @param params.accommodationId - The accommodation being synced.
 * @param params.presentEventIds - Ids of events present in this full fetch.
 * @returns The number of orphaned rows removed.
 */
const cleanupOrphans = async (params: {
    accommodationId: string;
    presentEventIds: ReadonlySet<string>;
}): Promise<number> => {
    const { accommodationId, presentEventIds } = params;

    const existingRows = await accommodationOccupancyModel.findBySource({
        accommodationId,
        source: PROVIDER
    });

    const orphanEventIds = new Set<string>();
    for (const row of existingRows) {
        const externalEventId = row.externalEventId;
        if (
            externalEventId !== null &&
            externalEventId !== undefined &&
            !presentEventIds.has(externalEventId)
        ) {
            orphanEventIds.add(externalEventId);
        }
    }

    let removed = 0;
    for (const externalEventId of orphanEventIds) {
        removed += await accommodationOccupancyModel.deleteByExternalEventId({
            accommodationId,
            source: PROVIDER,
            externalEventId
        });
    }
    return removed;
};

/**
 * Runs one Google Calendar → occupancy sync for a single accommodation.
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

    // 2. Fetch events (incremental if we have a token, else full). Recover from
    //    a stale token by falling back to a full sync.
    const timeMin = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
    let fullSync = credential.syncToken === null;
    let fetched: { events: GoogleCalendarEvent[]; nextSyncToken: string | undefined };
    try {
        fetched = await fetchAllPages({
            accessToken,
            calendarId,
            syncToken: credential.syncToken ?? undefined,
            timeMin: credential.syncToken === null ? timeMin : undefined
        });
    } catch (error) {
        if (error instanceof GoogleCalendarSyncTokenInvalidError) {
            fullSync = true;
            try {
                fetched = await fetchAllPages({
                    accessToken,
                    calendarId,
                    syncToken: undefined,
                    timeMin
                });
            } catch (fullError) {
                return recordFailure(
                    accommodationId,
                    fullError instanceof GoogleCalendarApiError ? 'api' : 'unknown',
                    fullError instanceof Error ? fullError.message : String(fullError)
                );
            }
        } else if (error instanceof GoogleCalendarApiError) {
            return recordFailure(accommodationId, 'api', error.message);
        } else {
            return recordFailure(
                accommodationId,
                'unknown',
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    // 3. Reconcile each event; track present (non-cancelled) ids for the
    //    full-sync orphan pass.
    let datesUpserted = 0;
    let datesRemoved = 0;
    const presentEventIds = new Set<string>();

    try {
        for (const event of fetched.events) {
            if (event.status !== 'cancelled') {
                presentEventIds.add(event.id);
            }
            const { upserted, removed } = await reconcileEvent({
                accommodationId,
                event,
                createdById: credential.createdById
            });
            datesUpserted += upserted;
            datesRemoved += removed;
        }

        if (fullSync) {
            datesRemoved += await cleanupOrphans({ accommodationId, presentEventIds });
        }
    } catch (error) {
        return recordFailure(
            accommodationId,
            'unknown',
            error instanceof Error ? error.message : String(error)
        );
    }

    // 4. Persist success + the new sync token.
    await accommodationCalendarSyncModel.updateSyncState({
        accommodationId,
        provider: PROVIDER,
        ...(fetched.nextSyncToken === undefined ? {} : { syncToken: fetched.nextSyncToken }),
        lastSyncAt: new Date(),
        lastSyncStatus: CalendarSyncStatusEnum.OK,
        lastErrorMessage: null
    });

    return {
        status: 'ok',
        eventsProcessed: fetched.events.length,
        datesUpserted,
        datesRemoved,
        fullSync
    };
};

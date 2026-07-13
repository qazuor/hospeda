/**
 * Google Calendar REST client (HOS-157 Phase 2 — Layer 3).
 *
 * Thin native-`fetch` client over the Google Calendar API v3 `events.list`
 * endpoint, exposing exactly what the occupancy sync service needs: a single
 * page fetch that supports both full and incremental synchronization.
 *
 * ## Full vs incremental sync
 *
 * - **Full sync** (no `syncToken`): pass `timeMin` to bound the window. The
 *   final page's response carries `nextSyncToken`, which the caller stores for
 *   the next run.
 * - **Incremental sync** (`syncToken` from a prior run): only entries changed
 *   since that token are returned, INCLUDING deleted events (`status:
 *   'cancelled'`). `showDeleted` cannot be false in this mode, so this client
 *   never sends it. When the token has expired, Google responds `410 GONE`
 *   (`reason: fullSyncRequired`) — surfaced here as
 *   {@link GoogleCalendarSyncTokenInvalidError} so the caller can wipe its
 *   stored token and re-run a full sync.
 *
 * Pagination is the caller's responsibility: follow `nextPageToken` until it is
 * absent, keeping every other parameter (notably `syncToken`) identical across
 * pages, per Google's sync guide.
 *
 * @see https://developers.google.com/workspace/calendar/api/guides/sync
 * @see https://developers.google.com/workspace/calendar/api/v3/reference/events/list
 * @module services/google-calendar/google-calendar-client
 */

/** Base URL for the Google Calendar API v3 events collection. */
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

/** Default page size for `events.list` (Google's max is 2500). */
const DEFAULT_MAX_RESULTS = 250;

/**
 * A single event's start or end marker. Google uses `date` (inclusive start /
 * EXCLUSIVE end) for all-day events and `dateTime` (RFC3339, with offset) for
 * timed events — exactly one is present.
 */
export interface GoogleCalendarEventDate {
    /** All-day marker, `YYYY-MM-DD`. Present for all-day events. */
    readonly date?: string;
    /** Timed marker, RFC3339 with offset (e.g. `2026-07-10T14:00:00-03:00`). Present for timed events. */
    readonly dateTime?: string;
    /** IANA timezone name Google associated with the marker, when provided. */
    readonly timeZone?: string;
}

/**
 * The subset of a Google Calendar event the occupancy sync consumes. Google
 * returns many more fields; only these are read.
 */
export interface GoogleCalendarEvent {
    /** Stable event id, used as `externalEventId` on the occupancy rows. */
    readonly id: string;
    /** Event status. `'cancelled'` marks a deletion in incremental sync results. */
    readonly status?: string;
    /** Event start marker (absent on some cancelled events in incremental results). */
    readonly start?: GoogleCalendarEventDate;
    /** Event end marker (absent on some cancelled events in incremental results). */
    readonly end?: GoogleCalendarEventDate;
}

/**
 * One page of `events.list` output.
 */
export interface ListEventsResult {
    /** The events on this page. */
    readonly items: readonly GoogleCalendarEvent[];
    /** Present when more pages remain — pass back as `pageToken` to continue. */
    readonly nextPageToken?: string;
    /** Present ONLY on the final page — store for the next incremental sync. */
    readonly nextSyncToken?: string;
}

/**
 * Input for {@link listEvents}.
 */
export interface ListEventsInput {
    /** A valid Google OAuth access token (obtained via the token service). */
    readonly accessToken: string;
    /** The calendar id to read (e.g. `'primary'`). */
    readonly calendarId: string;
    /** Incremental sync token from a prior run. Omit for a full sync. */
    readonly syncToken?: string;
    /** Full-sync lower bound (RFC3339). Only used when `syncToken` is absent. */
    readonly timeMin?: string;
    /** Pagination cursor from a prior page's `nextPageToken`. */
    readonly pageToken?: string;
    /** Page size (default {@link DEFAULT_MAX_RESULTS}). */
    readonly maxResults?: number;
    /**
     * IANA timezone the response's `dateTime` values should be formatted in
     * (Calendar API `timeZone` param). Google normalizes every timed event to
     * this zone server-side, so the caller's date extraction is deterministic
     * regardless of the calendar's own default zone. All-day `date` values are
     * unaffected. When omitted, Google uses the calendar's default zone.
     */
    readonly timeZone?: string;
}

/**
 * Thrown when Google responds `410 GONE` with `reason: fullSyncRequired` — the
 * stored `syncToken` is no longer valid. The caller must clear its stored token
 * and re-run a full sync.
 */
export class GoogleCalendarSyncTokenInvalidError extends Error {
    constructor(
        message = 'Google Calendar sync token is no longer valid; a full sync is required'
    ) {
        super(message);
        this.name = 'GoogleCalendarSyncTokenInvalidError';
    }
}

/**
 * Thrown for any non-2xx `events.list` response other than the 410 handled by
 * {@link GoogleCalendarSyncTokenInvalidError}. Carries the HTTP status so the
 * sync service can classify retryable (5xx/429) vs terminal (401/403) failures.
 */
export class GoogleCalendarApiError extends Error {
    /** HTTP status code returned by the Calendar API. */
    public readonly status: number;
    /** Parsed JSON error body, when available. */
    public readonly body?: Record<string, unknown>;

    constructor(message: string, status: number, body?: Record<string, unknown>) {
        super(message);
        this.name = 'GoogleCalendarApiError';
        this.status = status;
        this.body = body;
    }
}

/**
 * Attempts to parse a fetch `Response` body as JSON, returning `undefined` on
 * empty/invalid bodies.
 *
 * @param response - The fetch `Response` to parse.
 * @returns The parsed JSON, or `undefined`.
 */
const tryParseJson = async (response: Response): Promise<Record<string, unknown> | undefined> => {
    try {
        const text = await response.text();
        if (!text) {
            return undefined;
        }
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return undefined;
    }
};

/**
 * Detects Google's `fullSyncRequired` reason inside a parsed 410 error body.
 *
 * @param body - The parsed error body from a 410 response.
 * @returns `true` when the body's nested `error.errors[].reason` is `fullSyncRequired`.
 */
const isFullSyncRequired = (body: Record<string, unknown> | undefined): boolean => {
    if (body === undefined) {
        // A bare 410 with no parseable body is still treated as a stale token —
        // the safe action (full resync) is the same either way.
        return true;
    }
    const error = body.error;
    if (typeof error !== 'object' || error === null) {
        return true;
    }
    const errors = (error as { errors?: unknown }).errors;
    if (!Array.isArray(errors)) {
        return true;
    }
    return errors.some(
        (e) =>
            typeof e === 'object' &&
            e !== null &&
            (e as { reason?: unknown }).reason === 'fullSyncRequired'
    );
};

/**
 * Builds the `events.list` query string for a single page.
 *
 * @param input - The list parameters.
 * @returns A `URLSearchParams` for the request.
 */
const buildQuery = (input: ListEventsInput): URLSearchParams => {
    const query = new URLSearchParams({
        singleEvents: 'true',
        maxResults: String(input.maxResults ?? DEFAULT_MAX_RESULTS)
    });
    if (input.syncToken !== undefined) {
        // Incremental: syncToken is incompatible with timeMin/showDeleted=false.
        query.set('syncToken', input.syncToken);
    } else if (input.timeMin !== undefined) {
        // Full sync: bound the window so past events are not re-imported.
        query.set('timeMin', input.timeMin);
    }
    if (input.pageToken !== undefined) {
        query.set('pageToken', input.pageToken);
    }
    if (input.timeZone !== undefined) {
        // Google formats every returned dateTime in this zone, making the
        // caller's date extraction deterministic across calendar zones.
        query.set('timeZone', input.timeZone);
    }
    return query;
};

/**
 * Fetches a single page of events from the Google Calendar API.
 *
 * @param input - The calendar id, access token, and sync/pagination params.
 * @returns One {@link ListEventsResult} page.
 * @throws {GoogleCalendarSyncTokenInvalidError} On `410 GONE` (stale sync token).
 * @throws {GoogleCalendarApiError} On any other non-2xx response.
 *
 * @example
 * ```ts
 * const page = await listEvents({ accessToken, calendarId: 'primary', syncToken });
 * for (const event of page.items) { ... }
 * // follow page.nextPageToken until absent; store page.nextSyncToken at the end.
 * ```
 */
export const listEvents = async (input: ListEventsInput): Promise<ListEventsResult> => {
    const query = buildQuery(input);
    const url = `${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(input.calendarId)}/events?${query.toString()}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${input.accessToken}`,
            Accept: 'application/json'
        }
    });

    if (response.status === 410) {
        const body = await tryParseJson(response);
        if (isFullSyncRequired(body)) {
            throw new GoogleCalendarSyncTokenInvalidError();
        }
        throw new GoogleCalendarApiError('Google Calendar returned 410', 410, body);
    }

    if (!response.ok) {
        const body = await tryParseJson(response);
        throw new GoogleCalendarApiError(
            `Google Calendar events.list failed with status ${response.status}`,
            response.status,
            body
        );
    }

    const raw = (await response.json()) as {
        items?: GoogleCalendarEvent[];
        nextPageToken?: string;
        nextSyncToken?: string;
    };

    return {
        items: raw.items ?? [],
        ...(raw.nextPageToken === undefined ? {} : { nextPageToken: raw.nextPageToken }),
        ...(raw.nextSyncToken === undefined ? {} : { nextSyncToken: raw.nextSyncToken })
    };
};

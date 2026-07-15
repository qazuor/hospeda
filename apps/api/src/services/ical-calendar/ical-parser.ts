/**
 * iCal feed → occupancy date rows parser/adapter (HOS-162 Phase 3 — Layer B).
 *
 * Parses a raw `.ics` feed (Airbnb / Booking.com / any RFC 5545 export) into
 * the same `{ date, externalEventId }` row shape the Google Calendar sync
 * produces, so both providers can eventually feed the identical
 * `replaceFutureSyncOccupancy` reconcile primitive. This module owns ONLY the
 * parsing/adaptation concern — no fetch scheduling, no DB writes, no cron
 * wiring (those are later phases).
 *
 * Two entry points, deliberately split for testability:
 *
 * - {@link parseIcsToRows} — PURE(-ish, no I/O beyond the `node-ical` parse
 *   call): takes already-fetched `.ics` text and returns rows. Exercised
 *   directly by unit tests with inline fixture strings — no network, no SSRF
 *   surface.
 * - {@link fetchAndParseIcsFeed} — the thin I/O wrapper hosts actually call:
 *   fetches the user-supplied feed URL through `safeExternalFetch`
 *   (`@repo/utils/safe-fetch`), then delegates to {@link parseIcsToRows}.
 *
 * ## SSRF — why `safeExternalFetch`, never `ical.async.fromURL`
 *
 * The feed URL is USER-SUPPLIED (a host pastes their private Airbnb/Booking
 * `.ics` URL). `node-ical`'s own `fromURL`/`async.fromURL` perform a raw
 * `fetch` with no SSRF hardening — fetching an attacker-controlled URL that
 * way could reach localhost, cloud-metadata endpoints, or other internal
 * hosts. `fetchAndParseIcsFeed` therefore never calls `ical.*fromURL`; it
 * fetches the raw text itself via `safeExternalFetch` (the same SSRF-guarded
 * wrapper the accommodation-import adapters use — HTTPS-only, DNS
 * private-IP blocking with TOCTOU-free IP pinning, timeout, and a body-size
 * cap) and only ever hands `node-ical` an in-memory string via
 * `ical.async.parseICS`.
 *
 * ## The half-open `[start, end)` semantics (shared with Google Calendar)
 *
 * Reuses the exact same provider-agnostic primitives Google Calendar sync
 * uses (`../calendar-sync/date-range.js`, extracted from
 * `google-calendar-sync.service.ts` in this same phase): `markerToDate` and
 * `enumerateHalfOpenDates`. An all-day VEVENT's `DTEND` is EXCLUSIVE per
 * RFC 5545 — a Jul-10→Jul-12 all-day reservation blocks Jul-10 and Jul-11,
 * leaving the checkout day (Jul-12) free — exactly the same "≥1 day" rule
 * Google Calendar events follow.
 *
 * ## `node-ical` all-day date quirk (verified empirically, NOT documented
 * clearly upstream) — the key timezone gotcha of this module
 *
 * For a `VALUE=DATE` (all-day) marker such as `DTSTART;VALUE=DATE:20260710`,
 * `node-ical` does NOT hand back a plain string or a UTC-midnight `Date`. It
 * constructs a JS `Date` at **local PROCESS midnight** for that calendar day
 * (flagged via `.dateOnly === true`), where "local" means whatever
 * `TZ`/`Intl` zone the current Node process happens to be running under —
 * e.g. under `TZ=America/Argentina/Buenos_Aires` a `20260710` DATE becomes
 * `2026-07-10T03:00:00.000Z`; under `TZ=UTC` the same input becomes
 * `2026-07-10T00:00:00.000Z`; under `TZ=Asia/Tokyo` it becomes
 * `2026-07-09T15:00:00.000Z`. Naively reading that `Date` with
 * `toISOString()`/UTC getters is therefore only correct for
 * negative-or-zero UTC-offset process timezones — for a positive-offset zone
 * (e.g. Tokyo) it silently returns the PREVIOUS calendar day.
 *
 * The fix ({@link toDateMarker}) reads all-day markers with the `Date`
 * object's LOCAL getters (`getFullYear`/`getMonth`/`getDate`), never UTC
 * getters or `toISOString`. Construction and reading are symmetric — both
 * anchored to whichever timezone the process happens to run under — so the
 * local getters always recover the exact calendar day `node-ical` encoded,
 * REGARDLESS of the deployed process's `TZ`. This was confirmed with a
 * throwaway probe script across `TZ=UTC`, `TZ=America/Argentina/Buenos_Aires`,
 * and `TZ=Asia/Tokyo` before writing this module (see HOS-162 Phase B report).
 *
 * Timed VEVENTs (`DTSTART`/`DTEND` with a real time-of-day, whether UTC `Z`
 * or a `TZID`) are, by contrast, resolved by `node-ical` to a genuine UTC
 * instant — process-timezone-invariant by construction. Those are formatted
 * in {@link ICAL_MARKET_TIMEZONE} (the same Argentine market zone the Google
 * Calendar sync requests via its `SYNC_RESPONSE_TIMEZONE`), so a
 * cross-midnight timed reservation lands on the correct AR wall-clock day.
 *
 * ## RRULE (recurring events) are NOT expanded — known limitation
 *
 * `node-ical`'s `parseICS` does NOT auto-expand a `RRULE` recurring VEVENT
 * into its individual occurrences — it hands back a single VEVENT component
 * carrying an `.rrule` property (an `rrule.js` `RRule` instance) alongside
 * the ORIGINAL `DTSTART`/`DTEND` of just the first occurrence. Reading only
 * `.start`/`.end`, as this module does, would silently block just that first
 * occurrence and miss every recurrence after it — a misleading half-applied
 * result that looks like a successful sync but is actually wrong. Airbnb and
 * Booking.com feeds do not emit `RRULE` (each reservation is its own
 * VEVENT), so this only matters for a generic `OTHER`/PMS feed. Rather than
 * enumerate recurrences (out of scope for this phase), {@link parseIcsToRows}
 * SKIPS any VEVENT carrying an `.rrule`, logging a `warn` so the gap is
 * visible in operational logs instead of silently under-applied.
 *
 * @module services/ical-calendar/ical-parser
 */

import { type SafeFetchInput, safeExternalFetch } from '@repo/utils/safe-fetch';
import type { CalendarComponent, VEvent } from 'node-ical';
import ical from 'node-ical';
import { apiLogger } from '../../utils/logger.js';
import {
    type DateOrDateTimeMarker,
    enumerateHalfOpenDates,
    markerToDate
} from '../calendar-sync/date-range.js';

/**
 * IANA timezone used to resolve a TIMED VEVENT's wall-clock day. Matches the
 * Google Calendar sync's `SYNC_RESPONSE_TIMEZONE` for consistent AR-market
 * day semantics across both providers. All-day VEVENTs are unaffected — see
 * the module doc's `node-ical` quirk section.
 */
const ICAL_MARKET_TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Reused across calls — `Intl.DateTimeFormat` construction is not free. */
const arDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: ICAL_MARKET_TIMEZONE });

/** One occupancy row derived from a live (non-cancelled) VEVENT. */
export interface IcalOccupancyRow {
    /** The occupied calendar day, `YYYY-MM-DD`. */
    readonly date: string;
    /** The VEVENT's `UID`, used as the row's external event id. */
    readonly externalEventId: string;
}

/** Returned when the feed was fetched/parsed successfully. */
export interface IcalParseSuccess {
    readonly ok: true;
    /** Deduped (first-wins), `fromDate`-filtered occupancy rows. */
    readonly rows: readonly IcalOccupancyRow[];
}

/**
 * Returned when the feed could not be turned into occupancy rows. Never
 * thrown — both {@link parseIcsToRows} and {@link fetchAndParseIcsFeed}
 * always resolve to a typed result.
 */
export interface IcalParseFailure {
    readonly ok: false;
    /**
     * - `fetch_error` — the feed URL could not be retrieved (SSRF block,
     *   timeout, non-2xx, oversized body).
     * - `parse_error` — `node-ical` either threw while parsing the fetched
     *   text, or returned a result with NO recognizable calendar component
     *   (no `VCALENDAR` and zero `VEVENT`s) — i.e. the input is not
     *   iCalendar data at all. A WELL-FORMED `VCALENDAR` with zero `VEVENT`s
     *   (e.g. a new host with no bookings yet) is explicitly NOT a failure —
     *   see {@link parseIcsToRows}'s success case, `rows: []`.
     */
    readonly kind: 'fetch_error' | 'parse_error';
    /** Human-readable failure detail. */
    readonly message: string;
}

/** Discriminated union returned by both parser entry points. */
export type IcalParseResult = IcalParseSuccess | IcalParseFailure;

/**
 * Type predicate narrowing a parsed `node-ical` component to a `VEVENT`.
 * `node-ical` returns a flat `Record<uid, CalendarComponent>` mixing
 * `VCALENDAR`/`VTIMEZONE`/`VEVENT` entries under one union type — this is the
 * only reliable discriminant.
 *
 * @param component - A parsed calendar component (possibly `undefined` under
 * `noUncheckedIndexedAccess`, since `Object.values` on a `node-ical`
 * `CalendarResponse` record widens element types accordingly).
 * @returns `true` when `component` is defined and `component.type === 'VEVENT'`.
 */
const isVEvent = (component: CalendarComponent | undefined): component is VEvent =>
    component !== undefined && component.type === 'VEVENT';

/**
 * Type predicate identifying `node-ical`'s top-level `VCALENDAR` component
 * (keyed `'vcalendar'` in the parsed record, carrying `PRODID`/`VERSION`/
 * etc.). Used as the A1 discriminator: its PRESENCE, independent of whether
 * any `VEVENT` follows, is what marks the input as a genuinely-parsed
 * iCalendar document rather than garbage/non-calendar text (verified
 * empirically against `node-ical` 0.26.1 — a `BEGIN:VCALENDAR` envelope with
 * zero `VEVENT`s still yields this component; unparseable text yields an
 * empty `{}` record with neither).
 *
 * @param component - A parsed calendar component (possibly `undefined` under
 * `noUncheckedIndexedAccess`).
 * @returns `true` when `component` is defined and `component.type === 'VCALENDAR'`.
 */
const isVCalendarComponent = (component: CalendarComponent | undefined): boolean =>
    component !== undefined && component.type === 'VCALENDAR';

/**
 * Converts a `node-ical` VEVENT `start`/`end` value into the shared
 * {@link DateOrDateTimeMarker} shape consumed by `markerToDate`. See the
 * module doc's "node-ical all-day date quirk" section for why all-day
 * markers MUST be read with local `Date` getters and timed markers MUST be
 * formatted in {@link ICAL_MARKET_TIMEZONE}.
 *
 * @param value - The VEVENT's `start` or `end` value, if present (`node-ical`
 * types this as a `Date` carrying an extra `dateOnly` flag for all-day
 * markers).
 * @returns A `DateOrDateTimeMarker` ready for `markerToDate`, or `undefined`
 * when the value is absent or not a valid `Date`.
 */
const toDateMarker = (value: VEvent['start'] | undefined): DateOrDateTimeMarker | undefined => {
    if (value === undefined || Number.isNaN(value.getTime())) {
        return undefined;
    }

    if (value.dateOnly === true) {
        // All-day marker: read with LOCAL getters — see module doc.
        const yyyy = value.getFullYear();
        const mm = String(value.getMonth() + 1).padStart(2, '0');
        const dd = String(value.getDate()).padStart(2, '0');
        return { date: `${yyyy}-${mm}-${dd}` };
    }

    // Timed marker: a real UTC instant — format in the AR market zone.
    return { dateTime: `${arDayFormatter.format(value)}T00:00:00` };
};

/**
 * Parses already-fetched `.ics` text into deduped, `fromDate`-filtered
 * occupancy rows. No network I/O — safe to call directly from unit tests
 * with inline fixture strings.
 *
 * Pipeline:
 * 1. Parse via `node-ical`'s `async.parseICS`. A thrown parse error is
 *    caught and returned as `{ ok: false, kind: 'parse_error' }` — never
 *    propagated.
 * 2. Collect every `VEVENT` component and check for a `VCALENDAR` component
 *    (see {@link isVCalendarComponent}). If there are zero VEVENTs AND no
 *    VCALENDAR component was found, the input is not recognizable iCalendar
 *    data at all (garbage / non-calendar text) → `{ ok: false, kind:
 *    'parse_error' }`. A WELL-FORMED calendar with zero VEVENTs (e.g. a new
 *    host's feed with no bookings yet) is a legitimate SUCCESS with `rows:
 *    []` — this is the HOS-162 judgment-day A1 fix: it must never be
 *    rejected as an error, or `connectIcal` would 400 a perfectly valid feed.
 * 3. Skip any VEVENT carrying an `.rrule` (a `RRULE` recurring event) — see
 *    the module doc's "RRULE are NOT expanded" section. Logged via
 *    `apiLogger.warn` so the gap stays visible.
 * 4. Skip any VEVENT whose `STATUS` is `CANCELLED` (case-insensitive, per
 *    RFC 5545 §3.8.1.11 the property value is case-insensitive text).
 * 5. Skip any VEVENT missing a usable `UID`, or whose `start`/`end` do not
 *    resolve to usable dates.
 * 6. Map each live VEVENT to its half-open occupied dates
 *    (`enumerateHalfOpenDates`), collapsing to one entry per date — the
 *    FIRST VEVENT (in feed order) to cover a date wins its provenance,
 *    mirroring the Google Calendar sync's overlap-collapse behavior.
 * 7. Filter the final set to `date >= fromDate` and return.
 *
 * @param input.icsText - The raw `.ics` feed contents.
 * @param input.fromDate - Inclusive lower bound (`YYYY-MM-DD`) for returned rows.
 * @returns An {@link IcalParseResult} — never throws.
 *
 * @example
 * ```ts
 * const result = await parseIcsToRows({ icsText, fromDate: '2026-07-14' });
 * if (result.ok) {
 *   console.log(result.rows); // [{ date: '2026-07-14', externalEventId: 'abc@airbnb.com' }, ...]
 * }
 * ```
 */
export const parseIcsToRows = async (input: {
    readonly icsText: string;
    readonly fromDate: string;
}): Promise<IcalParseResult> => {
    const { icsText, fromDate } = input;

    let parsed: Awaited<ReturnType<typeof ical.async.parseICS>>;
    try {
        parsed = await ical.async.parseICS(icsText);
    } catch (error) {
        return {
            ok: false,
            kind: 'parse_error',
            message: error instanceof Error ? error.message : 'Failed to parse iCal feed'
        };
    }

    const components = Object.values(parsed);
    const events = components.filter(isVEvent);

    if (events.length === 0 && !components.some(isVCalendarComponent)) {
        // No VEVENTs AND no VCALENDAR wrapper — not recognizable iCalendar
        // data at all (garbage / non-calendar text), distinct from a
        // well-formed empty calendar (handled below as a success).
        return {
            ok: false,
            kind: 'parse_error',
            message: 'The feed does not look like a valid iCalendar (.ics) document'
        };
    }

    // Desired blocked-date set: one entry per date, first live VEVENT (feed
    // order) to cover a date wins its provenance — same collapse rule as the
    // Google Calendar sync.
    const desired = new Map<string, string>();
    for (const event of events) {
        if (typeof event.uid !== 'string' || event.uid.length === 0) {
            continue;
        }
        if (event.rrule !== undefined) {
            // Recurring VEVENT — node-ical does not expand RRULE occurrences.
            // Reading .start/.end here would only block the first occurrence
            // and silently miss the rest. Skip and log instead of
            // half-applying it. See module doc "RRULE are NOT expanded".
            apiLogger.warn(
                { uid: event.uid },
                'ical-parser: skipping recurring VEVENT (RRULE) — recurrence expansion is not supported (HOS-162 Phase 3 known limitation)'
            );
            continue;
        }
        if (typeof event.status === 'string' && event.status.toUpperCase() === 'CANCELLED') {
            continue;
        }

        const startDate = markerToDate(toDateMarker(event.start));
        const endDate = markerToDate(toDateMarker(event.end));
        if (startDate === undefined || endDate === undefined) {
            continue;
        }

        for (const date of enumerateHalfOpenDates(startDate, endDate)) {
            if (!desired.has(date)) {
                desired.set(date, event.uid);
            }
        }
    }

    const rows: IcalOccupancyRow[] = [...desired]
        .filter(([date]) => date >= fromDate)
        .map(([date, externalEventId]) => ({ date, externalEventId }));

    return { ok: true, rows };
};

/**
 * Fetches a user-supplied `.ics` feed URL through the SSRF-hardened
 * `safeExternalFetch` and parses it via {@link parseIcsToRows}. This is the
 * ONLY entry point that performs network I/O — hosts' import connect flow
 * (a later phase) calls this, never `parseIcsToRows` directly with an
 * unfetched URL, and never `node-ical`'s own `fromURL`.
 *
 * @param input.feedUrl - The user-supplied `.ics` feed URL. Must be HTTPS —
 * `safeExternalFetch` rejects any other scheme.
 * @param input.fromDate - Inclusive lower bound (`YYYY-MM-DD`) for returned rows.
 * @param input.timeoutMs - Forwarded to `safeExternalFetch` (default 8s).
 * @param input.maxBytes - Forwarded to `safeExternalFetch` (default 3 MB).
 * @returns An {@link IcalParseResult} — never throws.
 *
 * @example
 * ```ts
 * const result = await fetchAndParseIcsFeed({
 *   feedUrl: 'https://www.airbnb.com/calendar/ical/12345.ics?s=abc',
 *   fromDate: '2026-07-14',
 * });
 * ```
 */
export const fetchAndParseIcsFeed = async (input: {
    readonly feedUrl: string;
    readonly fromDate: string;
    readonly timeoutMs?: SafeFetchInput['timeoutMs'];
    readonly maxBytes?: SafeFetchInput['maxBytes'];
}): Promise<IcalParseResult> => {
    const { feedUrl, fromDate, timeoutMs, maxBytes } = input;

    const fetchResult = await safeExternalFetch({
        url: feedUrl,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
        ...(maxBytes === undefined ? {} : { maxBytes })
    });

    if (!fetchResult.ok) {
        return { ok: false, kind: 'fetch_error', message: fetchResult.error };
    }

    return parseIcsToRows({ icsText: fetchResult.body, fromDate });
};

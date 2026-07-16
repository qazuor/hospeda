/**
 * Provider-agnostic half-open date-range helpers (HOS-162 Phase 3 — Layer B).
 *
 * These are the PURE date-math primitives shared by every occupancy calendar
 * sync source (Google Calendar — HOS-157 Phase 2 — and iCal import — HOS-162
 * Phase 3). They implement the single "half-open `[startDate, endDate)`"
 * semantics that both providers rely on to turn a reservation's start/end
 * markers into the set of `YYYY-MM-DD` dates it occupies, with the checkout
 * day always left free.
 *
 * Extracted verbatim (DRY / single-source-of-truth) from
 * `google-calendar-sync.service.ts`, which already passed judgment-day review
 * and is running in production — this module changes NOTHING about the
 * behavior, only the location. Provider-specific mapping (turning a Google
 * Calendar event or an iCal VEVENT into start/end markers, applying
 * provider-specific business rules such as `status === 'cancelled'`
 * filtering) stays in each provider's own module; only the pure date math
 * lives here.
 *
 * @module services/calendar-sync/date-range
 */

/** Milliseconds in a day, for half-open date enumeration. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * IANA timezone shared by every calendar-sync provider (Google Calendar,
 * iCal/Airbnb/Booking/OTHER) for anchoring "today" — the platform targets
 * only the AR market (Litoral) and accommodations carry no per-property
 * timezone. AR is a fixed UTC-3 offset (no DST since 2009), so this is safe
 * to hardcode; revisit only if non-AR accommodations are onboarded.
 */
export const MARKET_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Reused across calls — `Intl.DateTimeFormat` construction is not free and
 * this formatter is stateless (safe to share across every caller).
 */
const marketDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: MARKET_TIMEZONE });

/**
 * Returns "today" as `YYYY-MM-DD` in {@link MARKET_TIMEZONE}, the AR market
 * zone — NOT UTC. This is the canonical `fromDate` anchor for every
 * declarative full-window occupancy reconcile (Google Calendar sync, iCal
 * import sync): using UTC here would, during the ~3h UTC-vs-AR daily
 * overlap, place `fromDate` a day ahead of an event's AR date and let a past
 * date slip through.
 *
 * Extracted verbatim from `google-calendar-sync.service.ts` (HOS-157 Phase 2,
 * already in production) so both providers share one implementation instead
 * of two independently-drifting copies of the same one-liner.
 *
 * @returns Today's date, `YYYY-MM-DD`, in the AR market timezone.
 *
 * @example
 * ```ts
 * getTodayInMarketTimezone(); // '2026-07-14'
 * ```
 */
export const getTodayInMarketTimezone = (): string => marketDayFormatter.format(new Date());

/**
 * Defensive cap on the number of days a single event/reservation may occupy.
 * Guards against a pathological multi-year event exploding into tens of
 * thousands of rows.
 */
export const MAX_EVENT_DAYS = 370;

/**
 * A single event/reservation's start or end marker, generalized across
 * calendar providers. Google Calendar and iCal both distinguish an
 * inclusive-start / exclusive-end all-day `date` from a timed `dateTime`;
 * exactly one is expected to be present on any given marker.
 */
export interface DateOrDateTimeMarker {
    /** All-day marker, `YYYY-MM-DD`. Present for all-day events. */
    readonly date?: string;
    /** Timed marker, RFC3339 with offset (e.g. `2026-07-10T14:00:00-03:00`). Present for timed events. */
    readonly dateTime?: string;
}

/**
 * Extracts the wall-clock `YYYY-MM-DD` date from an event start/end marker.
 * All-day markers expose `date` directly; timed markers expose `dateTime`
 * whose `YYYY-MM-DD` prefix is the date in whichever timezone the caller
 * already normalized the marker to (each provider is responsible for that
 * normalization before calling this helper).
 *
 * @param marker - The event start or end marker, if present.
 * @returns The `YYYY-MM-DD` date, or `undefined` when the marker is absent/unusable.
 *
 * @example
 * ```ts
 * markerToDate({ date: '2026-07-10' }); // '2026-07-10'
 * markerToDate({ dateTime: '2026-07-10T14:00:00-03:00' }); // '2026-07-10'
 * markerToDate(undefined); // undefined
 * ```
 */
export const markerToDate = (marker: DateOrDateTimeMarker | undefined): string | undefined => {
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
 *
 * @example
 * ```ts
 * enumerateHalfOpenDates('2026-07-10', '2026-07-12'); // ['2026-07-10', '2026-07-11']
 * enumerateHalfOpenDates('2026-07-10', '2026-07-10'); // [] (same-day, empty range)
 * ```
 */
export const enumerateHalfOpenDates = (startDate: string, endDate: string): string[] => {
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

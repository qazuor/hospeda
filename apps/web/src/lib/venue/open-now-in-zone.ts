/**
 * @file open-now-in-zone.ts
 * @description Evaluates the "open now" badge in the venue's own time zone.
 *
 * `computeOpenNowStatus` reads `now.getHours()` / `now.getDay()`, i.e. the local
 * clock of whichever process calls it. That was a fixed clock while the badge
 * was rendered on the server, but once the calculation moves to the browser it
 * becomes the VISITOR's clock: a tourist reading the listing from another time
 * zone would see a badge built from their own wall clock instead of the venue's.
 *
 * This module reads the day, hour and minute of `now` IN the venue's zone with
 * `Intl.DateTimeFormat(...).formatToParts`, assembles a synthetic wall-clock
 * `Date` carrying exactly those values, and delegates to `computeOpenNowStatus`
 * unchanged. The synthetic date is built with the `Date` component constructor,
 * which always interprets its arguments as local time — so its `getDay()` and
 * `getHours()` return the values that were fed in, regardless of the host
 * machine's time zone.
 */

import type { VenueOpeningHoursEntry } from '@/data/types';
import { computeOpenNowStatus } from '@/lib/venue-hours';

/**
 * Time zone the badge is evaluated in until a listing carries its own.
 *
 * It matches the `OpeningHoursSchema` default and every listing of this
 * vertical is located in Argentina. The per-listing `timezone` is discarded by
 * `normalizeOpeningHours`, so carrying it to the browser is deliberately out of
 * scope here; this constant is the single place to revisit if a listing ever
 * lives elsewhere.
 */
export const VENUE_OPEN_NOW_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** `Intl` short weekday name (en-US) to `Date.prototype.getDay()` index. */
const WEEKDAY_TO_INDEX: Readonly<Record<string, number>> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
};

/**
 * Day of January 2024 that falls on a Sunday. `7 + dayIndex` therefore lands on
 * the requested weekday inside the synthetic wall clock below.
 */
const SUNDAY_REFERENCE_DAY = 7;

/**
 * Arguments accepted by {@link computeOpenNowInZone}.
 */
export interface ComputeOpenNowInZoneParams {
    /** The full week map from the API response. */
    readonly openingHours: Record<string, VenueOpeningHoursEntry>;
    /** The instant to evaluate. */
    readonly now: Date;
    /** IANA zone the listing lives in. Defaults to {@link VENUE_OPEN_NOW_TIME_ZONE}. */
    readonly timeZone?: string;
}

/** Parameters for reading a weekday in a specific IANA time zone. */
export interface TodayIndexInZoneParams {
    /** The instant to evaluate. */
    readonly now: Date;
    /** IANA zone used to read the weekday. */
    readonly timeZone: string;
}

/**
 * Returns the weekday index (Sunday = 0 through Saturday = 6) in `timeZone`.
 *
 * @param params - The instant and IANA time zone.
 * @returns The weekday index, or `NaN` if Intl returns an unknown weekday.
 */
export function todayIndexInZone({ now, timeZone }: TodayIndexInZoneParams): number {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
        .formatToParts(now)
        .find((part) => part.type === 'weekday')?.value;

    return weekday === undefined ? Number.NaN : (WEEKDAY_TO_INDEX[weekday] ?? Number.NaN);
}

/**
 * Computes "open now" using the venue's wall clock instead of the caller's.
 *
 * Reads the weekday, hour and minute of `now` in `timeZone`, rebuilds that
 * wall-clock reading as a local `Date`, and delegates to
 * `computeOpenNowStatus` — so the DEC-FAC-052 overnight rule keeps living in
 * one place.
 *
 * @param params - Opening hours, the instant, and the target zone.
 * @returns `true` (open), `false` (closed), or `null` (no data for today → no badge).
 */
export function computeOpenNowInZone({
    openingHours,
    now,
    timeZone = VENUE_OPEN_NOW_TIME_ZONE
}: ComputeOpenNowInZoneParams): boolean | null {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23'
    }).formatToParts(now);

    let hour = Number.NaN;
    let minute = Number.NaN;

    for (const part of parts) {
        if (part.type === 'hour') hour = Number(part.value) % 24;
        else if (part.type === 'minute') minute = Number(part.value);
    }

    const dayIndex = todayIndexInZone({ now, timeZone });
    if (!Number.isFinite(dayIndex) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
        return null;
    }

    // Built from components, so `getDay()`/`getHours()` mirror the venue's wall
    // clock no matter the time zone of the process running this code.
    const wallClock = new Date(2024, 0, SUNDAY_REFERENCE_DAY + dayIndex, hour, minute, 0, 0);

    return computeOpenNowStatus(openingHours, wallClock);
}

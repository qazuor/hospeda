/**
 * @file venue-hours.ts
 * @description Helpers for computing "open now" status and today's opening-hours
 * entry from a venue listing's `openingHours` map (SPEC-239 T-053 / T-054).
 *
 * The `openingHours` field on the public API response is a `Record<string, …>`
 * keyed by lower-cased English day names: `monday`, `tuesday`, … `sunday`.
 * This matches the `VenueOpeningHoursEntry` interface in `@/data/types`.
 *
 * All functions are pure and accept an injected `now` date so they are trivially
 * unit-testable without time-zone tricks.
 */

import type { VenueOpeningHoursEntry } from '@/data/types';

/** Map from `Date.prototype.getDay()` (0 = Sunday) to the API day key. */
const DAY_INDEX_TO_KEY: readonly string[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
] as const;

/**
 * Returns the opening-hours day-key for a given `Date` using the local clock.
 *
 * @param date - The moment to query. Defaults to `new Date()`.
 * @returns A string like `'monday'`, `'sunday'`, etc.
 *
 * @example
 * ```ts
 * const key = getDayKey(new Date('2024-01-15')); // "monday"
 * ```
 */
export function getDayKey(date: Date = new Date()): string {
    return DAY_INDEX_TO_KEY[date.getDay()] ?? 'monday';
}

/**
 * Returns the today-index (0–6) that matches the `DAY_INDEX_TO_KEY` array.
 * Exposed so UI components can highlight the current-day row without
 * duplicating the same `getDay()` call.
 *
 * @param date - The moment to query. Defaults to `new Date()`.
 * @returns A number 0–6 (Sunday = 0, Monday = 1, …, Saturday = 6).
 */
export function getTodayIndex(date: Date = new Date()): number {
    return date.getDay();
}

/**
 * Returns an array of the seven day-keys in display order starting from Monday,
 * matching the conventional week layout for Spanish-speaking audiences.
 * Sunday is moved to the end.
 */
export const ORDERED_DAY_KEYS: readonly string[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
] as const;

/**
 * Parses a `"HH:mm"` time string and returns it as total minutes since midnight.
 * Returns `null` when the input is absent or malformed.
 *
 * @param timeStr - Time string in `"HH:mm"` 24-hour format (e.g. `"09:30"`).
 * @returns Total minutes since midnight, or `null` on parse failure.
 */
export function parseTimeToMinutes(timeStr: string | undefined): number | null {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
}

/**
 * Returns `true` when any shift of `entry` covers `currentMinutes` on the day
 * that entry describes. A wrapping shift (close <= open) only covers the
 * `[open, 24:00)` part of its start day; the part after midnight belongs to
 * the following day's lookback.
 */
function entryCoversNowOnItsStartDay(
    entry: VenueOpeningHoursEntry | undefined,
    currentMinutes: number
): boolean {
    if (!entry?.isOpen || entry.shifts.length === 0) return false;

    for (const shift of entry.shifts) {
        const openMinutes = parseTimeToMinutes(shift.open);
        const closeMinutes = parseTimeToMinutes(shift.close);
        if (openMinutes === null || closeMinutes === null) continue;

        if (closeMinutes <= openMinutes) {
            // Overnight shift: only its start-day part [open, 24:00) is today.
            if (currentMinutes >= openMinutes) return true;
        } else if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
            return true;
        }
    }

    return false;
}

/**
 * Returns `true` when a wrapping shift of `entry` (the previous day) spills
 * past midnight into the current one, i.e. `now < close`.
 */
function entryWrapsIntoToday(
    entry: VenueOpeningHoursEntry | undefined,
    currentMinutes: number
): boolean {
    if (!entry?.isOpen || entry.shifts.length === 0) return false;

    for (const shift of entry.shifts) {
        const openMinutes = parseTimeToMinutes(shift.open);
        const closeMinutes = parseTimeToMinutes(shift.close);
        if (openMinutes === null || closeMinutes === null) continue;

        if (closeMinutes <= openMinutes && currentMinutes < closeMinutes) return true;
    }

    return false;
}

/**
 * Computes whether the venue listing is currently open based on the
 * `openingHours` map and the current local time.
 *
 * A day can have multiple shifts (e.g. midday and night service); the listing
 * is "open now" when the current time falls inside ANY shift that covers it.
 *
 * Rules (DEC-FAC-052):
 * - A shift belongs to the day it starts on. An overnight shift that wraps
 *   midnight (22:00 → 02:00) belongs to its start day, not the following one.
 * - Today's shifts cover `[open, close)`; a wrapping shift (close <= open) is
 *   only evaluated on `[open, 24:00)` of its start day, because the part after
 *   midnight belongs to the previous day's shift, not to today's copy.
 * - Yesterday's wrapping shifts cover `now` when `now < close`. Yesterday is
 *   the previous `getDay()` index, so Sunday looks back to Saturday and Monday
 *   to Sunday.
 * - If a shift from today or yesterday covers `now` → `true`, even when
 *   today's entry is missing or has `isOpen: false` (e.g. Sunday 03:00 after a
 *   Saturday overnight shift).
 * - Otherwise → `null` when there is no entry for today (badge omitted), and
 *   `false` when today's entry exists.
 *
 * @param openingHours - The full week map from the API response.
 * @param now - Moment to evaluate. Defaults to `new Date()`.
 * @returns `true` (open), `false` (closed), or `null` (data absent → no badge).
 */
export function computeOpenNowStatus(
    openingHours: Record<string, VenueOpeningHoursEntry>,
    now: Date = new Date()
): boolean | null {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayKey = getDayKey(now);
    const todayEntry = openingHours[todayKey];

    if (entryCoversNowOnItsStartDay(todayEntry, currentMinutes)) return true;

    // Yesterday is `(getDay() + 6) % 7`: Sunday looks back to Saturday and
    // Monday to Sunday (DEC-FAC-052).
    const yesterdayKey = DAY_INDEX_TO_KEY[(now.getDay() + 6) % 7] ?? 'monday';
    const yesterdayEntry = openingHours[yesterdayKey];

    if (entryWrapsIntoToday(yesterdayEntry, currentMinutes)) return true;

    return todayEntry ? false : null;
}

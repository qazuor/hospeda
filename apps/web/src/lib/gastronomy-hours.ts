/**
 * @file gastronomy-hours.ts
 * @description Helpers for computing "open now" status and today's opening-hours
 * entry from a gastronomy listing's `openingHours` map (SPEC-239 T-053 / T-054).
 *
 * The `openingHours` field on the public API response is a `Record<string, …>`
 * keyed by lower-cased English day names: `monday`, `tuesday`, … `sunday`.
 * This matches the `GastronomyOpeningHoursEntry` interface in `@/data/types`.
 *
 * All functions are pure and accept an injected `now` date so they are trivially
 * unit-testable without time-zone tricks.
 */

import type { GastronomyOpeningHoursEntry } from '@/data/types';

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
 * Computes whether the gastronomy listing is currently open based on the
 * `openingHours` map and the current local time.
 *
 * Rules:
 * - If the entry for today does not exist → `null` (badge omitted).
 * - If `isOpen === false` → `false` (closed today).
 * - If `open24h === true` → `true` (always open).
 * - Otherwise compare current local HH:mm to `[open, close]` window.
 *   - When `close` is absent → treat as open-ended (open until midnight).
 *   - When `close` < `open` (overnight span) the comparison wraps correctly.
 *
 * @param openingHours - The full week map from the API response.
 * @param now - Moment to evaluate. Defaults to `new Date()`.
 * @returns `true` (open), `false` (closed), or `null` (data absent → no badge).
 */
export function computeOpenNowStatus(
    openingHours: Record<string, GastronomyOpeningHoursEntry>,
    now: Date = new Date()
): boolean | null {
    const dayKey = getDayKey(now);
    const entry = openingHours[dayKey];
    if (!entry) return null;
    if (!entry.isOpen) return false;
    if (entry.open24h) return true;

    const openMinutes = parseTimeToMinutes(entry.open);
    if (openMinutes === null) return null;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (entry.close) {
        const closeMinutes = parseTimeToMinutes(entry.close);
        if (closeMinutes === null) return null;

        // Overnight span: e.g. open=22:00, close=02:00
        if (closeMinutes < openMinutes) {
            return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
        }
        return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }

    // No close time: open from open-time until midnight
    return currentMinutes >= openMinutes;
}

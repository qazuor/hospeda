import { EventDatePrecisionEnum } from '@repo/schemas';

/**
 * Minimal shape this helper needs from an event's `date` sub-object.
 *
 * Deliberately permissive on `start` / `end` / `precision`: by the time this
 * runs (right before the create/update mutation's fetch call), the admin
 * form has already serialized these as plain strings — or left them
 * `undefined` — via `unflattenValues`, not the `Date` instances the parsed
 * `EventDate` Zod type implies after server-side validation.
 */
export interface NormalizableEventDate {
    readonly start?: unknown;
    readonly end?: unknown;
    readonly precision?: unknown;
}

/**
 * Mutable counterpart of {@link NormalizableEventDate} used only for the
 * local working copy inside {@link normalizeEventDatePrecision} — the public
 * interface stays `readonly` (immutability-by-default per project convention)
 * while the copy we build and return needs writable fields.
 */
type MutableEventDate = {
    start?: unknown;
    end?: unknown;
    precision?: unknown;
};

/**
 * Snaps an ISO-parseable date string to the first day of its month at
 * midnight UTC.
 *
 * CRITICAL: reads the year/month via `Date#toISOString()`, which always
 * reports UTC, then builds the result as a plain template string — never via
 * local-time getters/setters (`getMonth`/`setDate`). Those read the runtime's
 * local timezone, so a UTC-midnight value near a month boundary (e.g.
 * `2026-04-01T00:00:00.000Z`) would resolve to the *previous* local day/month
 * in any timezone behind UTC (Argentina is UTC-3, so that instant is
 * `2026-03-31T21:00:00` local — `getMonth()` would wrongly read March). This
 * function never converts to local time, so it can't shift the month.
 *
 * Returns the input unchanged if it isn't a parseable date (defensive; the
 * caller is expected to have already validated the value upstream).
 */
function toFirstOfMonthUtc(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    const isoYearMonth = parsed.toISOString().slice(0, 7); // "YYYY-MM"
    return `${isoYearMonth}-01T00:00:00.000Z`;
}

/**
 * Normalizes an event's `date` object for submission (HOS-280).
 *
 * When `precision === 'MONTH'`, `start` (and `end`, if present) are snapped
 * to the first day of their respective month at UTC midnight — the specific
 * day-of-month picked in the (day-and-hour-oriented) date field is a
 * placeholder for a month-only event and must not leak into storage.
 *
 * `EXACT` precision (the default, and any other/missing value) leaves both
 * fields untouched. Non-string `start`/`end` (e.g. `undefined`, or an already
 * unset field) are also left untouched.
 */
export function normalizeEventDatePrecision<T extends NormalizableEventDate>(date: T): T {
    if (date.precision !== EventDatePrecisionEnum.MONTH) {
        return date;
    }

    const normalized: MutableEventDate = { ...date };

    if (typeof date.start === 'string' && date.start.length > 0) {
        normalized.start = toFirstOfMonthUtc(date.start);
    }

    if (typeof date.end === 'string' && date.end.length > 0) {
        normalized.end = toFirstOfMonthUtc(date.end);
    }

    return normalized as unknown as T;
}

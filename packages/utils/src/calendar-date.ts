/**
 * Calendar dates — values that name a DAY, with no time of day.
 * @module utils/calendar-date
 *
 * WHY THIS MODULE EXISTS
 *
 * A service date, a broadcast date, a coupon's "valid from" — these name a day,
 * not an instant. JavaScript has no type for that, so the repo stores them two
 * ways and both are ambiguous the moment you render them:
 *
 *   - a Postgres `date` column, travelling as a bare `'2026-08-13'`;
 *   - a `timestamptz` pinned to midnight UTC, `'2026-08-13T00:00:00.000Z'`,
 *     which is what `new Date('2026-08-13').toISOString()` produces and what
 *     every date picker in the admin writes.
 *
 * Both are UTC. Rendering either one with the ambient timezone — a browser in
 * Argentina, a laptop at UTC-3 — lands at 21:00 the PREVIOUS day, and the
 * screen shows a date that is off by one. That is one bug, and the August 2026
 * smoke found it four separate times (H-09, H-63, H-73, H-84) before anyone
 * noticed it was the same one. H-84 is the one that settled the shape: the
 * column type was never the cause, so a sweep for `date` columns can never
 * close it.
 *
 * THE CONVENTION THIS MODULE ENFORCES
 *
 * A calendar date is the day named in UTC. Every write site in the repo already
 * agrees on this — the 13 admin date pickers, `z.coerce.date()` on a bare
 * `YYYY-MM-DD`, and the API container itself, which runs in UTC. Only the
 * readers disagreed. So: pin the timezone at the point of rendering, and the
 * answer stops depending on who is looking.
 *
 * DO NOT USE THIS for values with a real time of day — `createdAt`, `updatedAt`,
 * a message timestamp, a suspension instant. Those genuinely happened at a
 * moment, and rendering them in the reader's own timezone is correct. Pinning
 * them to UTC would introduce the mirror image of this bug.
 */

/** `YYYY-MM-DD`, the shape a Postgres `date` column travels in. */
const BARE_CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day a calendar date names, decomposed. `month` is 1-12, not 0-11. */
export interface CalendarDateParts {
    readonly year: number;
    /** 1-12. Deliberately not the 0-11 that `Date.getMonth()` returns. */
    readonly month: number;
    readonly day: number;
}

/** Input for {@link getCalendarDateParts} and friends. */
export interface CalendarDateInput {
    /** A bare `YYYY-MM-DD`, an ISO instant, or a `Date`. */
    readonly value: string | Date | null | undefined;
}

/** Input for {@link formatCalendarDate}. */
export interface FormatCalendarDateInput extends CalendarDateInput {
    /** BCP-47 tag, e.g. `'es-AR'`. */
    readonly locale: string | readonly string[];
    /**
     * Passed through to `Intl.DateTimeFormat`. Any `timeZone` here is IGNORED —
     * see {@link formatCalendarDate}.
     */
    readonly options?: Intl.DateTimeFormatOptions;
}

/**
 * Whether `year`/`month`/`day` name a day that exists.
 *
 * Guards against `2026-02-31`, which every `Date` constructor silently rolls
 * forward into March rather than rejecting.
 */
function isRealDay(year: number, month: number, day: number): boolean {
    const probe = new Date(Date.UTC(year, month - 1, day));
    return (
        probe.getUTCFullYear() === year &&
        probe.getUTCMonth() === month - 1 &&
        probe.getUTCDate() === day
    );
}

/**
 * Reads the calendar day a value names, under the UTC convention.
 *
 * This is the primitive the other two functions are built on, and the only one
 * that is trivially testable: its answer is the same in every timezone, so a
 * test of it cannot flake with the runner's clock or locale.
 *
 * @param input - {@link CalendarDateInput}.
 * @returns The day it names, or null when the value names no real day.
 *
 * @example
 * ```ts
 * getCalendarDateParts({ value: '2026-08-13' });                 // { year: 2026, month: 8, day: 13 }
 * getCalendarDateParts({ value: '2026-08-13T00:00:00.000Z' });   // { year: 2026, month: 8, day: 13 }
 * getCalendarDateParts({ value: '2026-02-31' });                 // null
 * ```
 */
export function getCalendarDateParts({ value }: CalendarDateInput): CalendarDateParts | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
        const bare = BARE_CALENDAR_DATE.exec(value);
        if (bare) {
            const year = Number(bare[1]);
            const month = Number(bare[2]);
            const day = Number(bare[3]);
            return isRealDay(year, month, day) ? { year, month, day } : null;
        }
    }

    const instant = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(instant.getTime())) return null;

    return {
        year: instant.getUTCFullYear(),
        month: instant.getUTCMonth() + 1,
        day: instant.getUTCDate()
    };
}

/**
 * Reads a calendar date as a `Date` sitting at LOCAL midnight of the day it names.
 *
 * Use this when a caller needs a `Date` to compare, sort, or feed to a component
 * — not to render. To render, prefer {@link formatCalendarDate}, which cannot be
 * re-broken downstream by a `toLocaleDateString()` in the wrong timezone.
 *
 * Local midnight rather than UTC midnight is deliberate: it is the value for
 * which `date.getDate()` returns the day the user meant, in whatever timezone
 * the code happens to be running.
 *
 * @param input - {@link CalendarDateInput}.
 * @returns A local-midnight `Date`, or null when the value names no real day.
 */
export function parseCalendarDate({ value }: CalendarDateInput): Date | null {
    const parts = getCalendarDateParts({ value });
    if (!parts) return null;

    return new Date(parts.year, parts.month - 1, parts.day);
}

/**
 * Renders a calendar date as the day it names, for any reader anywhere.
 *
 * The timezone is pinned to UTC internally and a caller-supplied `timeZone` is
 * ignored on purpose. That is not a limitation — it is the entire fix. A
 * calendar date has no time of day, so there is no timezone to convert between;
 * letting the ambient one leak in is what produced H-09, H-63, H-73 and H-84.
 * Every other `Intl.DateTimeFormat` option is passed through untouched.
 *
 * @param input - {@link FormatCalendarDateInput}.
 * @returns The formatted day, or null when the value names no real day — never
 *          the string `'Invalid Date'`.
 *
 * @example
 * ```ts
 * // Read from Argentina (UTC-3), where the naive version shows 12/8/2026:
 * formatCalendarDate({ value: '2026-08-13T00:00:00.000Z', locale: 'es-AR' });
 * // '13/8/2026'
 *
 * formatCalendarDate({
 *     value: '2026-08-13',
 *     locale: 'es-AR',
 *     options: { day: 'numeric', month: 'long', year: 'numeric' }
 * });
 * // '13 de agosto de 2026'
 * ```
 */
export function formatCalendarDate({
    value,
    locale,
    options
}: FormatCalendarDateInput): string | null {
    const parts = getCalendarDateParts({ value });
    if (!parts) return null;

    const utcMidnight = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(utcMidnight);
}

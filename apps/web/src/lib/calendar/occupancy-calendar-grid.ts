/**
 * @file occupancy-calendar-grid.ts
 * @description Pure date/grid helpers for the host occupancy calendar
 * (`CalendarSection.client.tsx`, HOS-43 Phase 1).
 *
 * Deliberately framework-free (no React, no i18n) so the month-grid and
 * date-range math is unit-testable in isolation. All dates are handled as
 * LOCAL calendar days (`getFullYear`/`getMonth`/`getDate`), never via
 * `toISOString()` — the occupancy `date` column is an hour-less Postgres
 * `date` (HOS-43 R8), and a UTC round-trip would shift the day near
 * midnight in any timezone behind UTC (e.g. Argentina, UTC-3).
 */

/** A single `YYYY-MM-DD` date key, matching the `AccommodationOccupancy.date` shape. */
export type DateKey = string;

// ---------------------------------------------------------------------------
// Date <-> DateKey
// ---------------------------------------------------------------------------

/**
 * Formats a `Date` as a local `YYYY-MM-DD` key.
 *
 * @param params - The date to format.
 * @returns The local date key.
 */
export function toDateKey({ date }: { readonly date: Date }): DateKey {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parses a `YYYY-MM-DD` key into a local midnight `Date`.
 *
 * @param params - The date key to parse.
 * @returns The parsed local date.
 */
export function parseDateKey({ dateKey }: { readonly dateKey: DateKey }): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

// ---------------------------------------------------------------------------
// Month arithmetic
// ---------------------------------------------------------------------------

/**
 * Returns the first day of the month containing `date`.
 *
 * @param params - The reference date.
 * @returns A new `Date` set to day 1 of that month, local midnight.
 */
export function getStartOfMonth({ date }: { readonly date: Date }): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Returns the first day of the month `delta` months away from `date`.
 * `delta` may be negative to go backward.
 *
 * @param params - The reference date and the number of months to shift.
 * @returns A new `Date` set to day 1 of the shifted month.
 */
export function addMonths({ date, delta }: { readonly date: Date; readonly delta: number }): Date {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/**
 * Compares two dates by (year, month) only, ignoring the day.
 *
 * @param params - The two dates to compare.
 * @returns A negative number if `a`'s month is before `b`'s, positive if
 *   after, zero if the same month.
 */
export function compareMonths({ a, b }: { readonly a: Date; readonly b: Date }): number {
    const aIndex = a.getFullYear() * 12 + a.getMonth();
    const bIndex = b.getFullYear() * 12 + b.getMonth();
    return aIndex - bIndex;
}

// ---------------------------------------------------------------------------
// Month grid
// ---------------------------------------------------------------------------

/**
 * Builds a Monday-first month grid for `month`, padded with `null` cells so
 * the total length is always a multiple of 7 (full weeks).
 *
 * @param params - Any date within the target month.
 * @returns An array of `Date | null` cells, `null` marking leading/trailing
 *   padding outside the month.
 *
 * @example
 * ```ts
 * buildMonthGrid({ month: new Date(2026, 6, 1) }); // July 2026
 * // [null, null, null, Date(1), Date(2), Date(3), Date(4), Date(5), ...]
 * ```
 */
export function buildMonthGrid({ month }: { readonly month: Date }): readonly (Date | null)[] {
    const first = getStartOfMonth({ date: month });
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    // getDay(): 0=Sun..6=Sat. Shift so Monday=0..Sunday=6.
    const leadingBlanks = (first.getDay() + 6) % 7;

    const cells: (Date | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) {
        cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        cells.push(new Date(first.getFullYear(), first.getMonth(), day));
    }
    while (cells.length % 7 !== 0) {
        cells.push(null);
    }
    return cells;
}

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------

/**
 * Builds the inclusive, chronologically-ascending list of date keys between
 * `startKey` and `endKey` (order-independent — the earlier key always leads).
 *
 * @param params - The two boundary date keys (in either order).
 * @returns The inclusive range of date keys, ascending.
 *
 * @example
 * ```ts
 * buildDateRangeKeys({ startKey: '2026-07-12', endKey: '2026-07-10' });
 * // ['2026-07-10', '2026-07-11', '2026-07-12']
 * ```
 */
export function buildDateRangeKeys({
    startKey,
    endKey
}: {
    readonly startKey: DateKey;
    readonly endKey: DateKey;
}): readonly DateKey[] {
    const [lowKey, highKey] = startKey <= endKey ? [startKey, endKey] : [endKey, startKey];
    const cursor = parseDateKey({ dateKey: lowKey });
    const high = parseDateKey({ dateKey: highKey });

    const keys: DateKey[] = [];
    while (cursor.getTime() <= high.getTime()) {
        keys.push(toDateKey({ date: cursor }));
        cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
}

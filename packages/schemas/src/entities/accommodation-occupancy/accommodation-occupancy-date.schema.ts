import { z } from 'zod';

/**
 * Shared `YYYY-MM-DD` occupancy date validator (HOS-43 Phase 1).
 *
 * Single source of truth for every place an occupancy date string is
 * validated — the CRUD input schema (`date` / `dates[]`), the core stored
 * entity schema, the range query schema, and the API route-level date
 * schemas (`getOccupancy.ts` on all three tiers, `removeOccupancy.ts`). All
 * of these import {@link OccupancyDateSchema} instead of re-declaring the
 * regex, so the calendar-validity check below only needs to exist once.
 *
 * @module schemas/entities/accommodation-occupancy/date
 */

/**
 * Regex-only shape check: exactly `YYYY-MM-DD`. Deliberately permissive on
 * the actual calendar validity of the month/day components — see
 * {@link isCalendarValidDate} for the round-trip check layered on top.
 */
const OCCUPANCY_DATE_SHAPE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Same shape as {@link OCCUPANCY_DATE_SHAPE_REGEX} but with capturing groups
 * around year/month/day, used only by {@link isCalendarValidDate} to pull the
 * numeric components back out. Kept as a separate constant (rather than
 * adding capture groups to the schema-facing regex) so `.regex()`'s reported
 * match behaviour is unaffected by an implementation detail of the refine.
 */
const OCCUPANCY_DATE_CAPTURE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Round-trip calendar-validity check for an already shape-valid
 * `YYYY-MM-DD` string.
 *
 * A shape-only regex accepts calendar-invalid combinations like
 * `2026-02-30` or `2026-13-01` — `new Date(...)` silently rolls these
 * forward (e.g. `2026-02-30` becomes March 2nd) instead of throwing, so a
 * naive `!Number.isNaN(date.getTime())` check is not sufficient. This
 * parses the string as UTC midnight and asserts the re-serialized
 * year/month/day match the original input components exactly, rejecting
 * any value Postgres would otherwise reject with a raw 500 on insert.
 *
 * @param value - A string that has already passed {@link OCCUPANCY_DATE_SHAPE_REGEX}.
 * @returns `true` when `value` is a real calendar date.
 */
function isCalendarValidDate(value: string): boolean {
    const match = OCCUPANCY_DATE_CAPTURE_REGEX.exec(value);
    if (!match) {
        return false;
    }

    const [, yearStr, monthStr, dayStr] = match as unknown as [string, string, string, string];
    const parsed = new Date(`${value}T00:00:00Z`);

    if (Number.isNaN(parsed.getTime())) {
        return false;
    }

    return (
        parsed.getUTCFullYear() === Number(yearStr) &&
        parsed.getUTCMonth() + 1 === Number(monthStr) &&
        parsed.getUTCDate() === Number(dayStr)
    );
}

/**
 * Validates a single `YYYY-MM-DD` occupancy date string: shape (regex) AND
 * calendar validity (round-trip check). Rejects `2026-02-30`, `2026-13-01`,
 * etc. — inputs that would otherwise reach Postgres and raise a raw 500 on
 * insert into the native `date` column.
 *
 * @example
 * ```ts
 * OccupancyDateSchema.parse('2026-07-10'); // ok
 * OccupancyDateSchema.parse('2026-02-30'); // throws ZodError
 * ```
 */
export const OccupancyDateSchema = z
    .string({ message: 'zodError.accommodationOccupancy.date.required' })
    .regex(OCCUPANCY_DATE_SHAPE_REGEX, {
        message: 'zodError.accommodationOccupancy.date.pattern'
    })
    .refine(isCalendarValidDate, {
        message: 'zodError.accommodationOccupancy.date.invalid'
    });

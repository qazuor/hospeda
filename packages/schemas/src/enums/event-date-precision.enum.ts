/**
 * Precision of an event's date fields (HOS-280).
 *
 * Distinguishes events whose date is known down to the exact day from events
 * whose source only specifies a month (e.g. content imported from a source
 * that says "April 2026" with no specific day).
 *
 * - EXACT: Day, month, and year are all known and meaningful. This is the
 *   current/default behavior — `start`/`end` are rendered and compared with
 *   full day precision.
 * - MONTH: Only month and year are known. `start`/`end` still carry a full
 *   `Date` value for storage/sorting purposes, but the day-of-month component
 *   is a placeholder (the 1st) and MUST be ignored by any UI that renders the
 *   date — render the month and year only (e.g. "Abril 2026"), never a
 *   specific day.
 */
export enum EventDatePrecisionEnum {
    EXACT = 'EXACT',
    MONTH = 'MONTH'
}

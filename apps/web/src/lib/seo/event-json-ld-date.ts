/**
 * Event JSON-LD date-precision helpers (HOS-280).
 *
 * `EventJsonLd.astro` cannot render a specific day for a MONTH-precision
 * event (the stored day is a placeholder, always the 1st of the month) — the
 * structured data must admit the day is unknown rather than fabricate one.
 * schema.org's `Date` type accepts a bare `YYYY-MM` value for exactly this
 * case, so this module truncates the ISO date-time string instead of parsing
 * it through `Date`/`Intl` (which would require timezone handling this pure
 * string operation doesn't need).
 */

/**
 * Input for {@link toJsonLdEventDate}.
 */
export interface ToJsonLdEventDateParams {
    /** Full ISO 8601 date-time string (e.g. `'2027-02-01T00:00:00.000Z'`). */
    readonly isoDate: string;
    /**
     * Date precision (HOS-280). Defaults to `'EXACT'` — the ISO string is
     * returned unchanged, matching today's behavior byte-for-byte.
     */
    readonly precision?: 'EXACT' | 'MONTH';
}

/**
 * Truncates an ISO 8601 date-time string to its `YYYY-MM` prefix when
 * `precision: 'MONTH'`, otherwise returns the string unchanged.
 *
 * @param params - {@link ToJsonLdEventDateParams}
 * @returns The ISO date-time string (`'EXACT'`) or its `YYYY-MM` prefix (`'MONTH'`).
 *
 * @example
 * ```ts
 * toJsonLdEventDate({ isoDate: '2027-02-01T00:00:00.000Z', precision: 'MONTH' });
 * // '2027-02'
 *
 * toJsonLdEventDate({ isoDate: '2027-02-15T18:00:00.000Z' });
 * // '2027-02-15T18:00:00.000Z' (precision defaults to 'EXACT', unchanged)
 * ```
 */
export function toJsonLdEventDate({
    isoDate,
    precision = 'EXACT'
}: ToJsonLdEventDateParams): string {
    return precision === 'MONTH' ? isoDate.slice(0, 7) : isoDate;
}

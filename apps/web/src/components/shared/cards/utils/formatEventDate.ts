/**
 * @file formatEventDate.ts
 * @description Shared date-formatting helpers for event card components.
 *
 * Consolidates the three different ad-hoc approaches previously found in
 * EventCard, EventCardFeatured, and EventCardHorizontal into one typed,
 * testable module.
 *
 * All functions follow the RO-RO pattern and use `Intl` APIs so output is
 * always locale-aware. No external dependencies required.
 */

import type { SupportedLocale } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// BCP 47 mapping
// ---------------------------------------------------------------------------

/**
 * Maps the web app's short locale codes to full BCP 47 locale tags accepted
 * by `Intl` constructors.
 */
const BCP47_MAP: Readonly<Record<SupportedLocale, string>> = {
    es: 'es-AR',
    en: 'en-US',
    pt: 'pt-BR'
} as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Input for {@link formatEventDate}.
 */
export interface FormatEventDateParams {
    /**
     * ISO 8601 start date-time string.
     * Converted to `Date` internally; invalid strings produce `'Invalid Date'`.
     */
    readonly start: string;
    /**
     * Optional ISO 8601 end date-time string.
     * When omitted the event is treated as single-day/time.
     */
    readonly end?: string;
    /** Short locale code driving `Intl` output. */
    readonly locale: SupportedLocale;
    /**
     * Formatting mode:
     * - `'short'`        – Human-readable long-form date(s). Example: "15 de marzo de 2026".
     *                      Used by the plain EventCard list variant.
     * - `'compact'`      – Compact day + month abbreviation for overlay date blocks.
     *                      Example: `{ dateLine: '14-16 Ago', timeLine: '18:00 - 02:00' }`.
     *                      Used by EventCardFeatured.
     * - `'rangeWithTime'`– Compact range with rotated-month + time label for the
     *                      horizontal card date block.
     *                      Returns the same shape as `'compact'` plus `monthAbbr`.
     */
    readonly mode: 'short' | 'compact' | 'rangeWithTime';
}

/**
 * Result for `mode: 'short'`.
 */
export interface FormatEventDateShortResult {
    readonly mode: 'short';
    /** Formatted start date string (e.g. "15 de marzo de 2026"). */
    readonly startLabel: string;
    /** Formatted end date string, or `null` when no end date. */
    readonly endLabel: string | null;
}

/**
 * Result for `mode: 'compact'` and `mode: 'rangeWithTime'`.
 *
 * `monthAbbr` is only populated in `rangeWithTime` mode (used by the rotated
 * month label in EventCardHorizontal).
 */
export interface FormatEventDateCompactResult {
    readonly mode: 'compact' | 'rangeWithTime';
    /**
     * Compact day + month(s) representation.
     * Examples: `'15 Mar'`, `'14-16 Ago'`, `'14 Ago-16 Sep'`.
     */
    readonly dateLine: string;
    /**
     * Time range string, or `null` when start time is midnight (no real time set).
     * Examples: `'18:00 - 02:00'`, `'10:00 hs'`.
     */
    readonly timeLine: string | null;
    /**
     * Three-character uppercase month abbreviation from the start date.
     * Populated only for `rangeWithTime` mode; `null` for `compact`.
     * Example: `'AGO'`.
     */
    readonly monthAbbr: string | null;
}

/** Discriminated union returned by {@link formatEventDate}. */
export type FormatEventDateResult = FormatEventDateShortResult | FormatEventDateCompactResult;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns a 3-character uppercase month abbreviation for the given date.
 *
 * @param date - The date to extract the month from.
 * @param intlLocale - Full BCP 47 locale tag.
 * @returns Uppercase 3-char abbreviation, e.g. `'AGO'`, `'MAR'`.
 */
function getMonthAbbr(date: Date, intlLocale: string): string {
    return date
        .toLocaleDateString(intlLocale, { month: 'short' })
        .replace('.', '')
        .toUpperCase()
        .slice(0, 3);
}

/**
 * Returns whether two `Date` instances represent the same calendar day.
 */
function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getDate() === b.getDate() &&
        a.getMonth() === b.getMonth() &&
        a.getFullYear() === b.getFullYear()
    );
}

/**
 * Builds the compact date-range label string.
 *
 * - Single day or same day: `'15 Mar'`
 * - Same month range: `'14-16 Mar'`
 * - Cross-month range (compact): `'14 Mar-16 Abr'`
 * - Cross-month range (rangeWithTime with newline): `'14 Mar -\n16 Abr'`
 */
function buildDateLine(
    startDate: Date,
    endDate: Date | null,
    intlLocale: string,
    multiLineRange: boolean
): string {
    const startDay = startDate.getDate();
    const startMonthAbbr = getMonthAbbr(startDate, intlLocale);

    if (!endDate || isSameDay(startDate, endDate)) {
        return `${startDay} ${startMonthAbbr}`;
    }

    const endDay = endDate.getDate();
    const endMonthAbbr = getMonthAbbr(endDate, intlLocale);
    const sameMonth = startDate.getMonth() === endDate.getMonth();

    if (sameMonth) {
        return `${startDay}-${endDay} ${startMonthAbbr}`;
    }

    if (multiLineRange) {
        return `${startDay} ${startMonthAbbr} -\n${endDay} ${endMonthAbbr}`;
    }

    return `${startDay} ${startMonthAbbr}-${endDay} ${endMonthAbbr}`;
}

/**
 * Builds the time label string using `Intl.DateTimeFormat` for formatting.
 *
 * Returns `null` when the start time is midnight (indicates no real time set).
 *
 * @param startDate - Parsed start date.
 * @param endDate - Parsed end date, or `null`.
 * @param intlLocale - Full BCP 47 locale tag.
 * @param suffix - Optional suffix appended when only a start time is shown
 *   (e.g. `' hs'` for EventCardHorizontal).
 */
function buildTimeLine(
    startDate: Date,
    endDate: Date | null,
    intlLocale: string,
    suffix: string
): string | null {
    const fmt = (d: Date): string =>
        d.toLocaleTimeString(intlLocale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

    const startTime = fmt(startDate);
    if (startTime === '00:00') return null;

    if (!endDate) return `${startTime}${suffix}`;

    const endTime = fmt(endDate);
    if (endTime === '00:00') return `${startTime}${suffix}`;

    return `${startTime} - ${endTime}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Formats event start/end date-times into card-ready display strings.
 *
 * Three modes are supported — choose the one matching the card variant:
 *
 * | Mode | Used by | Returns |
 * |---|---|---|
 * | `'short'` | `EventCard` (list) | `startLabel` + `endLabel` |
 * | `'compact'` | `EventCardFeatured` | `dateLine` + `timeLine` |
 * | `'rangeWithTime'` | `EventCardHorizontal` | `dateLine` + `timeLine` + `monthAbbr` |
 *
 * @param params - {@link FormatEventDateParams}
 * @returns {@link FormatEventDateResult}
 *
 * @example
 * ```ts
 * // EventCard list variant
 * const result = formatEventDate({
 *   start: '2026-08-14T18:00:00Z',
 *   end:   '2026-08-16T02:00:00Z',
 *   locale: 'es',
 *   mode: 'short',
 * });
 * // result.startLabel → '14 de agosto de 2026'
 * // result.endLabel   → '16 de agosto de 2026'
 *
 * // Featured card overlay
 * const result2 = formatEventDate({
 *   start: '2026-08-14T18:00:00Z',
 *   end:   '2026-08-16T02:00:00Z',
 *   locale: 'es',
 *   mode: 'compact',
 * });
 * // result2.dateLine → '14-16 AGO'
 * // result2.timeLine → '18:00 - 02:00'
 *
 * // Horizontal card date block
 * const result3 = formatEventDate({
 *   start: '2026-08-14T18:00:00Z',
 *   locale: 'es',
 *   mode: 'rangeWithTime',
 * });
 * // result3.monthAbbr → 'AGO'
 * // result3.dateLine  → '14 Ago'
 * // result3.timeLine  → '18:00 hs'
 * ```
 */
export function formatEventDate(params: FormatEventDateParams): FormatEventDateResult {
    const { start, end, locale, mode } = params;
    const intlLocale = BCP47_MAP[locale];

    if (mode === 'short') {
        const startDate = new Date(start);
        const endDate = end ? new Date(end) : null;

        const startLabel = startDate.toLocaleDateString(intlLocale, { dateStyle: 'long' });
        const endLabel = endDate
            ? endDate.toLocaleDateString(intlLocale, { dateStyle: 'long' })
            : null;

        return { mode: 'short', startLabel, endLabel };
    }

    // 'compact' and 'rangeWithTime' share most logic
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;

    const multiLineRange = mode === 'rangeWithTime';
    const timeSuffix = mode === 'rangeWithTime' ? ' hs' : '';

    const dateLine = buildDateLine(startDate, endDate, intlLocale, multiLineRange);
    const timeLine = buildTimeLine(startDate, endDate, intlLocale, timeSuffix);
    const monthAbbr = mode === 'rangeWithTime' ? getMonthAbbr(startDate, intlLocale) : null;

    return { mode, dateLine, timeLine, monthAbbr };
}

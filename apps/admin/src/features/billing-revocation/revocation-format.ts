/**
 * @file revocation-format.ts
 * How the revocation screen (HOS-1678) writes amounts and dates: cents in the
 * payment's currency, and days in the market time zone, which is where the
 * 10-day revocation window is counted.
 *
 * @module revocation-format
 */

import { formatCurrency, formatDate } from '@repo/i18n';
import { MARKET_TIMEZONE } from '@repo/utils';

/** Day, month and year in the market time zone (e.g. `11/10/2026`). */
const DAY_OPTIONS: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: MARKET_TIMEZONE
};

/** Day and time in the market time zone. */
const INSTANT_OPTIONS: Intl.DateTimeFormatOptions = {
    ...DAY_OPTIONS,
    hour: '2-digit',
    minute: '2-digit'
};

/**
 * Formats an amount in cents.
 *
 * @param input - The cents, the locale and the currency (`ARS` when `null`).
 * @returns The formatted amount.
 */
export function formatRevocationAmount({
    cents,
    locale,
    currency
}: {
    readonly cents: number;
    readonly locale: string;
    readonly currency: string | null;
}): string {
    return formatCurrency({ value: cents / 100, locale, currency: currency ?? 'ARS' });
}

/**
 * Formats the day of an instant in the market time zone.
 *
 * @param input - The ISO instant and the locale.
 * @returns The day, month and year.
 */
export function formatRevocationDay({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: string;
}): string {
    return formatDate({ date: iso, locale, options: DAY_OPTIONS });
}

/**
 * Formats the last day the revocation is still allowed (H6). `windowEndsAt` is
 * EXCLUSIVE (the market midnight that opens day 11), so the last valid day is
 * the one holding the millisecond before it.
 *
 * @param input - The exclusive end of the window and the locale.
 * @returns The last valid day, inclusive.
 */
export function formatRevocationLastDay({
    windowEndsAt,
    locale
}: {
    readonly windowEndsAt: string;
    readonly locale: string;
}): string {
    return formatDate({
        date: new Date(Date.parse(windowEndsAt) - 1),
        locale,
        options: DAY_OPTIONS
    });
}

/**
 * Formats an instant (day and time) in the market time zone.
 *
 * @param input - The ISO instant and the locale.
 * @returns The day and time.
 */
export function formatRevocationInstant({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: string;
}): string {
    return formatDate({ date: iso, locale, options: INSTANT_OPTIONS });
}

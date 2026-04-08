/**
 * Formatting utilities for dates, prices, and numbers used across web components.
 *
 * Wraps `@repo/i18n` formatting primitives and adapts them to the web app's
 * `SupportedLocale` type. Provides `formatRelativeTime` which is not available
 * in the shared package.
 *
 * All functions follow the RO-RO pattern and accept short locale codes
 * ('es' | 'en' | 'pt'). Conversion to BCP 47 is handled internally.
 */

import {
    formatDate as i18nFormatDate,
    formatNumber as i18nFormatNumber,
    toBcp47Locale
} from '@repo/i18n';

import type { SupportedLocale } from './i18n';

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

/**
 * Input for {@link formatPrice}.
 */
export interface FormatPriceParams {
    /** Numeric amount in the smallest unit of the currency (e.g. centavos). */
    readonly amount: number;
    /** ISO 4217 currency code. Defaults to `'ARS'` when omitted. */
    readonly currency?: string;
    /** Short locale code used to select formatting conventions. */
    readonly locale: SupportedLocale;
    /** Whether to show decimal digits. Defaults to `false` (no centavos). */
    readonly showDecimals?: boolean;
}

/**
 * Formats a monetary amount into a locale-aware currency string.
 *
 * Internally converts the short locale code to its full BCP 47 equivalent so
 * `Intl.NumberFormat` applies the correct conventions (decimal separator,
 * grouping, currency symbol position).
 *
 * @param params - {@link FormatPriceParams}
 * @returns Formatted currency string (e.g. `"$ 12.500,00"`, `"$29.99"`).
 *
 * @example
 * ```ts
 * formatPrice({ amount: 12500, locale: 'es' })         // "$ 12.500,00"
 * formatPrice({ amount: 29.99, locale: 'en' })         // "$29.99"
 * formatPrice({ amount: 100, currency: 'USD', locale: 'es' }) // "US$ 100,00"
 * ```
 */
export function formatPrice({
    amount,
    currency,
    locale,
    showDecimals = false
}: FormatPriceParams): string {
    const bcp47 = toBcp47Locale(locale);
    const resolvedCurrency = currency ?? 'ARS';
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: resolvedCurrency,
        ...(showDecimals ? {} : { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    };
    return new Intl.NumberFormat(bcp47, options).format(amount);
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

/**
 * Input for {@link formatDate}.
 */
export interface FormatDateParams {
    /** Date value to format. Accepts `Date`, ISO string, or Unix timestamp (ms). */
    readonly date: Date | string | number;
    /** Short locale code used to select the calendar and formatting conventions. */
    readonly locale: SupportedLocale;
    /**
     * Optional `Intl.DateTimeFormatOptions` to override the default long-form
     * date style (`{ dateStyle: 'long' }`).
     *
     * Default output examples:
     * - `es` → "15 de marzo de 2026"
     * - `en` → "March 15, 2026"
     * - `pt` → "15 de março de 2026"
     */
    readonly options?: Intl.DateTimeFormatOptions;
}

/**
 * Formats a date value into a human-readable, locale-aware string.
 *
 * @param params - {@link FormatDateParams}
 * @returns Formatted date string.
 *
 * @throws {TypeError} When `date` is not a valid date value.
 *
 * @example
 * ```ts
 * formatDate({ date: new Date('2026-03-15'), locale: 'es' })
 * // "15 de marzo de 2026"
 *
 * formatDate({ date: '2026-03-15', locale: 'en' })
 * // "March 15, 2026"
 *
 * formatDate({
 *   date: new Date('2026-03-15'),
 *   locale: 'es',
 *   options: { day: 'numeric', month: 'short' }
 * })
 * // "15 mar"
 * ```
 */
export function formatDate({ date, locale, options }: FormatDateParams): string {
    return i18nFormatDate({ date, locale: toBcp47Locale(locale), options });
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

/**
 * Input for {@link formatRelativeTime}.
 */
export interface FormatRelativeTimeParams {
    /** The date to express relative to now. Accepts `Date`, ISO string, or Unix timestamp (ms). */
    readonly date: Date | string | number;
    /** Short locale code used to select language and formatting conventions. */
    readonly locale: SupportedLocale;
}

/**
 * Converts a past or future date to a relative time string (e.g. "hace 3 dias").
 *
 * Uses `Intl.RelativeTimeFormat` with `'auto'` numeric style so small differences
 * use words ("yesterday", "ayer") while larger ones fall back to numbers.
 *
 * The most appropriate time unit is chosen automatically:
 * - < 60 s   → seconds
 * - < 60 min → minutes
 * - < 24 h   → hours
 * - < 30 d   → days
 * - < 12 mo  → months
 * - otherwise → years
 *
 * @param params - {@link FormatRelativeTimeParams}
 * @returns Locale-aware relative time string.
 *
 * @example
 * ```ts
 * // Assuming current time is 2026-03-06T12:00:00Z
 * formatRelativeTime({ date: new Date('2026-03-05'), locale: 'es' })
 * // "ayer"
 *
 * formatRelativeTime({ date: new Date('2026-02-04'), locale: 'en' })
 * // "last month"
 *
 * formatRelativeTime({ date: new Date('2025-03-06'), locale: 'pt' })
 * // "ano passado"
 * ```
 */
export function formatRelativeTime({ date, locale }: FormatRelativeTimeParams): string {
    const bcp47 = toBcp47Locale(locale);
    const rtf = new Intl.RelativeTimeFormat(bcp47, { numeric: 'auto' });

    const now = Date.now();
    const target = date instanceof Date ? date.getTime() : new Date(date).getTime();
    const diffMs = target - now;
    const diffSec = Math.round(diffMs / 1000);
    const absSeconds = Math.abs(diffSec);

    if (absSeconds < 60) {
        return rtf.format(diffSec, 'second');
    }

    const diffMin = Math.round(diffSec / 60);
    if (Math.abs(diffMin) < 60) {
        return rtf.format(diffMin, 'minute');
    }

    const diffHour = Math.round(diffMin / 60);
    if (Math.abs(diffHour) < 24) {
        return rtf.format(diffHour, 'hour');
    }

    const diffDay = Math.round(diffHour / 24);
    if (Math.abs(diffDay) < 30) {
        return rtf.format(diffDay, 'day');
    }

    const diffMonth = Math.round(diffDay / 30);
    if (Math.abs(diffMonth) < 12) {
        return rtf.format(diffMonth, 'month');
    }

    const diffYear = Math.round(diffDay / 365);
    return rtf.format(diffYear, 'year');
}

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

/**
 * Input for {@link formatNumber}.
 */
export interface FormatNumberParams {
    /** The numeric value to format. */
    readonly value: number;
    /** Short locale code used to select decimal/grouping separator conventions. */
    readonly locale: SupportedLocale;
    /** Optional `Intl.NumberFormatOptions` to customize the output. */
    readonly options?: Intl.NumberFormatOptions;
}

/**
 * Formats a number using locale-specific conventions.
 *
 * @param params - {@link FormatNumberParams}
 * @returns Locale-aware formatted number string.
 *
 * @example
 * ```ts
 * formatNumber({ value: 1234567.89, locale: 'es' })  // "1.234.567,89"
 * formatNumber({ value: 1234567.89, locale: 'en' })  // "1,234,567.89"
 * formatNumber({ value: 0.5, locale: 'pt', options: { style: 'percent' } }) // "50%"
 * ```
 */
export function formatNumber({ value, locale, options }: FormatNumberParams): string {
    return i18nFormatNumber({ value, locale: toBcp47Locale(locale), options });
}

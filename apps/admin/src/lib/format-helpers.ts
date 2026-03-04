/**
 * Shared formatting utilities for the admin application.
 *
 * All helpers are thin wrappers around `@repo/i18n` formatting functions,
 * providing consistent null/undefined handling and sensible defaults for
 * the Argentina market (es-AR locale, ARS currency).
 */

import { defaultIntlLocale, formatCurrency, formatDate as i18nFormatDate } from '@repo/i18n';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Common input for date-formatting helpers.
 */
export interface FormatDateHelperInput {
    /** Date value to format. Accepts a `Date` object, ISO string, or Unix timestamp (ms). */
    readonly date: Date | string | number | null | undefined;
    /**
     * BCP 47 locale string used for formatting (e.g. `'es-AR'`, `'en-US'`).
     * Defaults to `defaultIntlLocale` (`'es-AR'`).
     */
    readonly locale?: string;
}

/**
 * Common input for currency-formatting helpers.
 */
export interface FormatCurrencyHelperInput {
    /** Monetary value in whole units (e.g. pesos, not centavos). */
    readonly value: number | null | undefined;
    /**
     * BCP 47 locale string used for formatting (e.g. `'es-AR'`, `'en-US'`).
     * Defaults to `defaultIntlLocale` (`'es-AR'`).
     */
    readonly locale?: string;
}

/**
 * Input for helpers that receive amounts in cents (1/100 of the base unit).
 */
export interface FormatCentsHelperInput {
    /** Monetary value in cents (e.g. centavos). Divided by 100 before formatting. */
    readonly cents: number | null | undefined;
    /**
     * BCP 47 locale string used for formatting (e.g. `'es-AR'`, `'en-US'`).
     * Defaults to `defaultIntlLocale` (`'es-AR'`).
     */
    readonly locale?: string;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Formats a date as `DD/MM/YYYY` (numeric short date).
 *
 * Returns `'—'` when `date` is `null` or `undefined`.
 *
 * @example
 * ```ts
 * formatShortDate({ date: '2026-03-15', locale: 'es-AR' })
 * // => "15/03/2026"
 * ```
 */
export function formatShortDate({
    date,
    locale = defaultIntlLocale
}: FormatDateHelperInput): string {
    if (!date) return '—';
    return i18nFormatDate({
        date,
        locale,
        options: { day: '2-digit', month: '2-digit', year: 'numeric' }
    });
}

/**
 * Formats a date as `DD/MM/YYYY HH:mm` (date with hours and minutes).
 *
 * Returns `'—'` when `date` is `null` or `undefined`.
 *
 * @example
 * ```ts
 * formatDateWithTime({ date: '2026-03-15T10:30:00Z', locale: 'es-AR' })
 * // => "15/03/2026 07:30"
 * ```
 */
export function formatDateWithTime({
    date,
    locale = defaultIntlLocale
}: FormatDateHelperInput): string {
    if (!date) return '—';
    return i18nFormatDate({
        date,
        locale,
        options: {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
    });
}

/**
 * Formats a date as `DD/MM/YYYY HH:mm:ss` (date with hours, minutes and seconds).
 *
 * Returns `'—'` when `date` is `null` or `undefined`.
 *
 * @example
 * ```ts
 * formatDateWithSeconds({ date: '2026-03-15T10:30:45Z', locale: 'es-AR' })
 * // => "15/03/2026 07:30:45"
 * ```
 */
export function formatDateWithSeconds({
    date,
    locale = defaultIntlLocale
}: FormatDateHelperInput): string {
    if (!date) return '—';
    return i18nFormatDate({
        date,
        locale,
        options: {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }
    });
}

/**
 * Formats a date with the full month name (e.g. "15 de marzo de 2026 07:30").
 *
 * Returns `'—'` when `date` is `null` or `undefined`.
 *
 * @example
 * ```ts
 * formatLongDate({ date: '2026-03-15T10:30:00Z', locale: 'es-AR' })
 * // => "15 de marzo de 2026 07:30"
 * ```
 */
export function formatLongDate({
    date,
    locale = defaultIntlLocale
}: FormatDateHelperInput): string {
    if (!date) return '—';
    return i18nFormatDate({
        date,
        locale,
        options: {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
    });
}

// ---------------------------------------------------------------------------
// Currency helpers
// ---------------------------------------------------------------------------

/**
 * Formats a whole-unit ARS amount (e.g. pesos, not centavos).
 *
 * Returns `'$ 0,00'` (or locale equivalent) when `value` is `null` or `undefined`.
 *
 * @example
 * ```ts
 * formatArs({ value: 1500, locale: 'es-AR' })
 * // => "$ 1.500,00"
 * ```
 */
export function formatArs({
    value,
    locale = defaultIntlLocale
}: FormatCurrencyHelperInput): string {
    return formatCurrency({ value: value ?? 0, locale, currency: 'ARS' });
}

/**
 * Formats a cents-based ARS amount by dividing by 100 before formatting.
 *
 * Returns `'$ 0,00'` (or locale equivalent) when `cents` is `null` or `undefined`.
 *
 * @example
 * ```ts
 * formatCentsToArs({ cents: 150000, locale: 'es-AR' })
 * // => "$ 1.500,00"
 * ```
 */
export function formatCentsToArs({
    cents,
    locale = defaultIntlLocale
}: FormatCentsHelperInput): string {
    return formatCurrency({ value: (cents ?? 0) / 100, locale, currency: 'ARS' });
}

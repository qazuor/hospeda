/**
 * Shared format helper utilities for notification email templates.
 *
 * Provides consistent currency and date formatting across all templates
 * using Argentine Spanish locale conventions.
 */

import { formatCalendarDate } from '@repo/utils';

/**
 * Input parameters for {@link formatCurrency}.
 */
export interface FormatCurrencyInput {
    /** Amount in cents (e.g. 150000 = $1,500.00). */
    readonly amount: number;
    /** ISO 4217 currency code (e.g. "ARS", "USD"). */
    readonly currency: string;
}

/**
 * Input parameters for {@link formatDate}.
 */
export interface FormatDateInput {
    /** ISO 8601 date string (e.g. "2026-03-15T00:00:00.000Z"). */
    readonly dateString: string;
}

/**
 * Format a currency amount for display in notification templates.
 *
 * Converts an amount in cents to a human-readable string using
 * Argentine Spanish locale formatting. Prepends "$" for ARS and
 * "USD " for USD; other currencies receive no symbol prefix.
 *
 * @param params - Amount in cents and ISO 4217 currency code
 * @returns Formatted string like "$1,500.00" (ARS) or "USD 1,500.00"
 *
 * @example
 * ```ts
 * formatCurrency({ amount: 150000, currency: 'ARS' }) // "$1.500,00"
 * formatCurrency({ amount: 150000, currency: 'USD' }) // "USD 1.500,00"
 * formatCurrency({ amount: 0,      currency: 'ARS' }) // "$0,00"
 * ```
 */
export function formatCurrency({ amount, currency }: FormatCurrencyInput): string {
    const amountInUnits = amount / 100;
    const formatted = amountInUnits.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const currencySymbol = currency === 'ARS' ? '$' : currency === 'USD' ? 'USD ' : '';
    return `${currencySymbol}${formatted}`;
}

/**
 * Format an ISO date string for display in notification templates.
 *
 * Converts an ISO 8601 date string to a long-form Spanish date using
 * the Argentine Spanish locale (e.g. "15 de marzo de 2026").
 *
 * Every value that reaches this function is rendered as a DAY — no template
 * shows a time — so the day is pinned to UTC rather than left to whatever
 * timezone the process happens to run in. That is not a behaviour change in
 * production: the API container runs in UTC, so this is exactly what it already
 * produced. What it removes is the dependence on that fact. Before, the two
 * examples below were only true under `TZ=UTC`; on a developer machine at UTC-3
 * both came out a day early, which is the same defect the August 2026 smoke
 * found on four screens (H-09, H-63, H-73, H-84) — here it was merely hidden by
 * the container's timezone rather than absent.
 *
 * @param params - ISO date string to format
 * @returns Formatted date string in Argentine Spanish locale, or `''` when the
 *          value names no real day.
 *
 * @example
 * ```ts
 * formatDate({ dateString: '2026-03-15' })                    // "15 de marzo de 2026"
 * formatDate({ dateString: '2026-12-01T00:00:00.000Z' })      // "1 de diciembre de 2026"
 * ```
 */
export function formatDate({ dateString }: FormatDateInput): string {
    return (
        formatCalendarDate({
            value: dateString,
            locale: 'es-AR',
            options: { day: 'numeric', month: 'long', year: 'numeric' }
        }) ?? ''
    );
}

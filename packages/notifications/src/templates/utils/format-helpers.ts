/**
 * Shared format helper utilities for notification email templates.
 *
 * Provides consistent currency and date formatting across all templates
 * using Argentine Spanish locale conventions.
 */

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
 * @param params - ISO date string to format
 * @returns Formatted date string in Argentine Spanish locale
 *
 * @example
 * ```ts
 * formatDate({ dateString: '2026-03-15' })                    // "15 de marzo de 2026"
 * formatDate({ dateString: '2026-12-01T00:00:00.000Z' })      // "1 de diciembre de 2026"
 * ```
 */
export function formatDate({ dateString }: FormatDateInput): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

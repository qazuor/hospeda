/**
 * Shared format helper utilities for notification email templates.
 *
 * Provides consistent currency and date formatting across all templates
 * using Argentine Spanish locale conventions.
 */

import { formatCalendarDate } from '@repo/utils';
import type { Major } from '../../types/money.js';

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
 * Input parameters for {@link formatMajorCurrency}.
 */
export interface FormatMajorCurrencyInput {
    /** Amount already in MAJOR units (ARS pesos), e.g. 5000 = $5.000,00. */
    readonly amount: Major;
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
 * Format a currency amount already expressed in MAJOR units (pesos) for
 * display in notification templates.
 *
 * Companion to {@link formatCurrency}, which expects CENTAVOS and divides by
 * 100 — do NOT use that one here. `PaymentNotificationPayload.amount` is
 * MAJOR units: its only producers, `sendPaymentSuccessNotification` and
 * `sendPaymentFailureNotifications`
 * (`apps/api/src/routes/webhooks/mercadopago/notifications.ts`), type the
 * parameter {@link Major} for exactly this reason (HOS-713/HOS-720). Passing
 * that value through `formatCurrency` divided a real charge by 100 in the
 * payment email BODY while the SUBJECT (fixed by HOS-830, which reads the
 * same field) already read it correctly — the same email showing two
 * different amounts (HOS-839).
 *
 * @param params - Amount in MAJOR units (pesos) and ISO 4217 currency code
 * @returns Formatted string like "$5.000,00" (ARS) or "USD 1.500,00"
 *
 * @example
 * ```ts
 * formatMajorCurrency({ amount: asMajor(5000), currency: 'ARS' }) // "$5.000,00"
 * formatMajorCurrency({ amount: asMajor(0),    currency: 'ARS' }) // "$0,00"
 * ```
 */
export function formatMajorCurrency({ amount, currency }: FormatMajorCurrencyInput): string {
    const formatted = amount.toLocaleString('es-AR', {
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

/**
 * Input parameters for {@link formatDateTime}.
 */
export interface FormatDateTimeInput {
    /** ISO 8601 instant with a timezone (e.g. "2026-11-21T12:00:00.000Z"). */
    readonly dateString: string;
}

/** Timezone staff read instants in. */
const STAFF_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: STAFF_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
});

/**
 * Formats an ISO instant as a short date and time in Argentina (HOS-2565 §7.2).
 *
 * Unlike {@link formatDate}, which names a calendar DAY under the UTC convention,
 * this renders an INSTANT, so it converts to `America/Argentina/Buenos_Aires`.
 * The parts are assembled by hand because `Intl` joins date and time with a
 * locale-dependent separator ("21/11/2026, 09:00" in some ICU versions).
 *
 * @param params - ISO instant to format
 * @returns "DD/MM/YYYY HH:mm" in Argentine time, or `''` when the value is not a real instant
 *
 * @example
 * ```ts
 * formatDateTime({ dateString: '2026-11-21T12:00:00.000Z' }) // "21/11/2026 09:00"
 * formatDateTime({ dateString: 'not a date' })              // ""
 * ```
 */
export function formatDateTime({ dateString }: FormatDateTimeInput): string {
    const instant = new Date(dateString);
    if (Number.isNaN(instant.getTime())) return '';
    const parts = Object.fromEntries(
        dateTimeFormatter.formatToParts(instant).map((part) => [part.type, part.value])
    );
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/**
 * Input parameters for {@link formatBillingCycleLabel}.
 */
export interface FormatBillingCycleLabelInput {
    /** Billing cycle as stored (`monthly`, `quarterly`, `semiannual`, `annual`). */
    readonly cycle: string;
}

/** Spanish label per known billing cycle (HOS-2565 D7). */
const BILLING_CYCLE_LABELS: Readonly<Record<string, string>> = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual'
};

/**
 * Spanish label of a billing cycle. The ONE map shared by the purchase
 * confirmation, the price-change notice and the reconciliation summary
 * (HOS-2565 D7).
 *
 * An unknown value renders as received: the raw value keeps the information
 * visible instead of hiding a row.
 *
 * @param params - The stored cycle
 * @returns The Spanish label, or the cycle itself when it is not known
 *
 * @example
 * ```ts
 * formatBillingCycleLabel({ cycle: 'monthly' }) // "Mensual"
 * formatBillingCycleLabel({ cycle: 'weekly' })  // "weekly"
 * ```
 */
export function formatBillingCycleLabel({ cycle }: FormatBillingCycleLabelInput): string {
    return Object.hasOwn(BILLING_CYCLE_LABELS, cycle)
        ? (BILLING_CYCLE_LABELS[cycle] as string)
        : cycle;
}

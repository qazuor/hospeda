import type { TranslationKey } from '@repo/i18n';
import { defaultIntlLocale } from '@repo/i18n';
import type { AdminPaymentViewStatus } from '@repo/schemas';
import {
    formatCentsToArs,
    formatDateWithTime as formatDateWithTimeHelper
} from '@/lib/format-helpers';
import type { PaymentStatus } from './types';

/**
 * Format a date string with time (DD/MM/YYYY HH:mm).
 * Backward-compatible wrapper around shared format helper.
 */
export function formatDate(date: string, locale: string = defaultIntlLocale): string {
    return formatDateWithTimeHelper({ date, locale });
}

/**
 * Format an ARS amount given in integer CENTAVOS.
 *
 * Thin wrapper around `formatCentsToArs` — kept here (rather than calling the
 * shared helper directly at every call site) so the "Cents" unit stays in the
 * function name callers actually import. The previous defect shipped because
 * a formatter named `formatArs` with JSDoc "Format a whole-unit ARS amount"
 * was handed `payment.amount`, which held centavos — the mismatch was
 * invisible at the call site. `formatArsFromCents(payment.amountInCents)`
 * reads as correct (or wrong) on sight.
 *
 * @example
 * ```ts
 * formatArsFromCents(1800000) // => "$ 18.000,00"
 * ```
 */
export function formatArsFromCents(
    cents: number | null | undefined,
    locale: string = defaultIntlLocale
): string {
    return formatCentsToArs({ cents, locale });
}

/**
 * Get status badge variant for a normalised payment status.
 *
 * Covers every member of {@link AdminPaymentViewStatus} — the real values
 * `billing_payments.status` holds. `completed` is intentionally NOT a case:
 * the API never emits it (see `AdminPaymentViewStatusSchema` JSDoc).
 */
export function getStatusVariant(
    status: PaymentStatus
): 'success' | 'default' | 'destructive' | 'outline' {
    const variants: Record<
        AdminPaymentViewStatus,
        'success' | 'default' | 'destructive' | 'outline'
    > = {
        succeeded: 'success',
        pending: 'default',
        processing: 'default',
        failed: 'destructive',
        canceled: 'destructive',
        refunded: 'outline',
        partially_refunded: 'outline'
    };
    return variants[status];
}

/**
 * Get status label using i18n. Covers every member of
 * {@link AdminPaymentViewStatus}.
 */
export function getStatusLabel(status: PaymentStatus, t: (key: TranslationKey) => string): string {
    const labels: Record<AdminPaymentViewStatus, TranslationKey> = {
        succeeded: 'admin-billing.payments.statuses.succeeded',
        pending: 'admin-billing.payments.statuses.pending',
        processing: 'admin-billing.payments.statuses.processing',
        failed: 'admin-billing.payments.statuses.failed',
        canceled: 'admin-billing.payments.statuses.canceled',
        refunded: 'admin-billing.payments.statuses.refunded',
        partially_refunded: 'admin-billing.payments.statuses.partiallyRefunded'
    };
    return t(labels[status]);
}

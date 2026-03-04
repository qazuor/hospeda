import {
    formatArs as formatArsHelper,
    formatDateWithTime as formatDateWithTimeHelper
} from '@/lib/format-helpers';
import { defaultIntlLocale } from '@repo/i18n';
import type { TranslationKey } from '@repo/i18n';
import type { PaymentMethod, PaymentStatus } from './types';

/**
 * Format a date string with time (DD/MM/YYYY HH:mm).
 * Backward-compatible wrapper around shared format helper.
 */
export function formatDate(date: string, locale: string = defaultIntlLocale): string {
    return formatDateWithTimeHelper({ date, locale });
}

/**
 * Format a whole-unit ARS amount.
 * Backward-compatible wrapper around shared format helper.
 */
export function formatArs(amount: number, locale: string = defaultIntlLocale): string {
    return formatArsHelper({ value: amount, locale });
}

/**
 * Get status badge variant based on payment status
 */
export function getStatusVariant(
    status: PaymentStatus
): 'success' | 'default' | 'destructive' | 'outline' {
    const variants = {
        completed: 'success',
        pending: 'default',
        failed: 'destructive',
        refunded: 'outline'
    } as const;
    return variants[status];
}

/**
 * Get status label using i18n
 */
export function getStatusLabel(status: PaymentStatus, t: (key: TranslationKey) => string): string {
    const labels = {
        completed: t('admin-billing.payments.statuses.completed'),
        pending: t('admin-billing.payments.statuses.pending'),
        failed: t('admin-billing.payments.statuses.failed'),
        refunded: t('admin-billing.payments.statuses.refunded')
    };
    return labels[status];
}

/**
 * Get payment method label using i18n
 */
export function getPaymentMethodLabel(
    method: PaymentMethod,
    t: (key: TranslationKey) => string
): string {
    const labels = {
        credit_card: t('admin-billing.payments.methods.creditCard'),
        debit_card: t('admin-billing.payments.methods.debitCard'),
        mercado_pago: t('admin-billing.payments.methods.mercadoPago'),
        bank_transfer: t('admin-billing.payments.methods.bankTransfer')
    };
    return labels[method];
}

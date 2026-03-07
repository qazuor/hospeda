import {
    formatArs as formatArsHelper,
    formatShortDate as formatShortDateHelper
} from '@/lib/format-helpers';
import { ALL_PLANS, type PlanDefinition } from '@repo/billing';
import { defaultIntlLocale } from '@repo/i18n';
import type { TranslationKey } from '@repo/i18n';
import type { SubscriptionStatus } from './types';

/**
 * Format a date string as short date (DD/MM/YYYY).
 * Backward-compatible wrapper around shared format helper.
 */
export function formatDate(date: string, locale: string = defaultIntlLocale): string {
    return formatShortDateHelper({ date, locale });
}

/**
 * Format a whole-unit ARS amount.
 * Backward-compatible wrapper around shared format helper.
 */
export function formatArs(amount: number, locale: string = defaultIntlLocale): string {
    return formatArsHelper({ value: amount, locale });
}

/**
 * Get status badge variant based on subscription status
 */
export function getStatusVariant(
    status: SubscriptionStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
    const variantMap: Record<
        SubscriptionStatus,
        'default' | 'secondary' | 'destructive' | 'outline'
    > = {
        active: 'default',
        trialing: 'secondary',
        cancelled: 'destructive',
        past_due: 'outline',
        expired: 'outline',
        paused: 'secondary'
    };
    return variantMap[status];
}

/**
 * Get status label using i18n
 */
export function getStatusLabel(
    status: SubscriptionStatus,
    t: (key: TranslationKey) => string
): string {
    const labels: Record<SubscriptionStatus, string> = {
        active: t('admin-billing.subscriptions.statuses.active'),
        trialing: t('admin-billing.subscriptions.statuses.trialing'),
        cancelled: t('admin-billing.subscriptions.statuses.cancelled'),
        past_due: t('admin-billing.subscriptions.statuses.pastDue'),
        expired: t('admin-billing.subscriptions.statuses.expired'),
        paused: t('admin-billing.subscriptions.statuses.paused')
    };
    return labels[status];
}

/**
 * Get plan details by slug
 */
export function getPlanBySlug(slug: string): PlanDefinition | undefined {
    return ALL_PLANS.find((plan) => plan.slug === slug);
}

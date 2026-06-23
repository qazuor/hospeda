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
        paused: 'secondary',
        comp: 'secondary'
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
        paused: t('admin-billing.subscriptions.statuses.paused'),
        comp: t('admin-billing.subscriptions.statuses.comp')
    };
    return labels[status];
}

/**
 * Get plan display details by slug.
 *
 * Returns the plan definition for UI-display purposes (plan name, price display, etc.).
 *
 * CONFIG-FALLBACK(SPEC-192): This is a display-only lookup that reads from the
 * static `ALL_PLANS` config catalog. It is intentionally NOT cut over to the
 * DB-backed `PlanService` in this task because:
 * 1. `PlanService` is a server-side service (not importable in client components).
 * 2. The admin subscription API response (`Subscription.planSlug`) does not carry
 *    plan display data. Plumbing it would require changes to API schema, hooks,
 *    and 3 consuming components — a wide cascade not in scope for T-027.
 * 3. This function is display-only and does not gate any billing logic.
 * When the admin subscriptions API is extended to include plan display data
 * (name, price, etc.), callers should be updated to use the API data directly.
 */
export function getPlanBySlug(slug: string): PlanDefinition | undefined {
    return ALL_PLANS.find((plan) => plan.slug === slug);
}

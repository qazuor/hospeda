/**
 * SubscriptionSummarySection — Section 1 of Mi facturación (SPEC-156 T-034).
 *
 * Read-only summary of the current user's active subscription. Renders:
 *   - plan name (or planId fallback) + status badge (i18n'd per AC-8)
 *   - current period end as a localized date
 *   - empty state when the user has no active subscription
 *   - error state when the API call fails
 *
 * Backed by `useMySubscription()` which hits
 * `GET /api/v1/protected/billing/subscriptions?pageSize=1` and returns the
 * first row (or null when the user has never subscribed).
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMySubscription } from '@/hooks/use-my-billing';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';

const KNOWN_STATUS_KEYS: ReadonlyArray<string> = [
    'active',
    'trialing',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'abandoned'
];

function statusTranslationKey(status: string | undefined): TranslationKey {
    if (status === undefined) return 'admin-pages.billing.subscription.status.unknown';
    // The protected billing endpoint may emit either `cancelled` (en-GB) or
    // `canceled` (en-US) depending on the upstream provider; collapse to the
    // i18n key shape `status.canceled` so a single set of translations covers
    // both.
    const normalized = status.replace('cancelled', 'canceled');
    if (KNOWN_STATUS_KEYS.includes(normalized)) {
        return `admin-pages.billing.subscription.status.${normalized}` as TranslationKey;
    }
    return 'admin-pages.billing.subscription.status.unknown';
}

function statusBadgeVariant(status: string | undefined): 'default' | 'destructive' | 'outline' {
    switch (status) {
        case 'active':
        case 'trialing':
            return 'default';
        case 'past_due':
        case 'canceled':
        case 'cancelled':
        case 'incomplete_expired':
        case 'abandoned':
            return 'destructive';
        default:
            return 'outline';
    }
}

function formatPeriodEnd(periodEndIso: string | undefined, locale: string): string | null {
    if (!periodEndIso) return null;
    const date = new Date(periodEndIso);
    if (Number.isNaN(date.getTime())) return null;
    try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
    } catch {
        return date.toISOString().slice(0, 10);
    }
}

export function SubscriptionSummarySection() {
    const { t, locale } = useTranslations();
    const query = useMySubscription();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">
                    {t('admin-pages.billing.subscription.title')}
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                    {t('admin-pages.billing.subscription.subtitle')}
                </p>
            </CardHeader>
            <CardContent>
                {query.isLoading && (
                    <div
                        className="h-16 animate-pulse rounded-lg bg-muted"
                        data-testid="subscription-loading"
                    />
                )}

                {query.isError && (
                    <p className="text-destructive text-sm">
                        {t('admin-pages.billing.subscription.errorLoading')}
                    </p>
                )}

                {query.data === null && !query.isLoading && !query.isError && (
                    <div data-testid="subscription-empty">
                        <p className="font-medium">
                            {t('admin-pages.billing.subscription.noActive.title')}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.billing.subscription.noActive.description')}
                        </p>
                    </div>
                )}

                {query.data && (
                    <div
                        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                        data-testid="subscription-summary"
                    >
                        <div className="space-y-1">
                            <p className="font-medium text-base">
                                {query.data.planName ?? query.data.planId ?? '—'}
                            </p>
                            {(() => {
                                const formatted = formatPeriodEnd(
                                    query.data.currentPeriodEnd,
                                    locale
                                );
                                if (!formatted) return null;
                                return (
                                    <p className="text-muted-foreground text-sm">
                                        {t('admin-pages.billing.subscription.currentPeriodEnd', {
                                            date: formatted
                                        })}
                                    </p>
                                );
                            })()}
                        </div>
                        <Badge
                            variant={statusBadgeVariant(query.data.status)}
                            data-testid="subscription-status-badge"
                        >
                            {t(statusTranslationKey(query.data.status))}
                        </Badge>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export { statusBadgeVariant, statusTranslationKey, formatPeriodEnd };

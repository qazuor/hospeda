/**
 * Subscription card component displaying the user's current plan and billing info.
 *
 * Fetches subscription data from the protected API endpoint and renders the
 * current plan status. Handles loading, error, and loaded states.
 *
 * @example
 * ```tsx
 * <SubscriptionCard locale="es" upgradeHref="/es/precios/turistas" />
 * ```
 */
import { AlertTriangleIcon, RefreshIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SubscriptionData } from '../../lib/api/endpoints-protected';
import { userApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { SubscriptionActiveView, SubscriptionFreePlanView } from './SubscriptionActiveView.client';

/** Stable keys for skeleton feature rows (avoids index key lint warning) */
const SKELETON_FEATURE_KEYS = ['feat-1', 'feat-2', 'feat-3', 'feat-4'] as const;

/** Props for the SubscriptionCard component */
interface SubscriptionCardProps {
    readonly locale: 'es' | 'en' | 'pt';
    readonly upgradeHref: string;
    readonly onChangePlan?: () => void;
    readonly onCancelSubscription?: () => void;
    readonly onReactivate?: () => void;
    readonly onUpdatePayment?: () => void;
}

/**
 * Subscription card React island.
 * Displays the authenticated user's current subscription plan and status.
 * Fetches data on mount and shows appropriate loading, error, or loaded states.
 *
 * @example
 * ```astro
 * <SubscriptionCard client:idle locale={locale} upgradeHref={`/${locale}/precios/turistas`} />
 * ```
 */
export function SubscriptionCard({
    locale,
    upgradeHref,
    onChangePlan,
    onCancelSubscription,
    onReactivate,
    onUpdatePayment
}: SubscriptionCardProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [data, setData] = useState<SubscriptionData | null>(null);

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'account' });
    const { t: tUi } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });

    const features = [
        t('subscription.feature1'),
        t('subscription.feature2'),
        t('subscription.feature3'),
        t('subscription.feature4')
    ] as const;

    const statusLabels: Record<string, string> = {
        active: t('subscription.statusActive'),
        trial: t('subscription.statusTrial'),
        cancelled: t('subscription.statusCancelled'),
        expired: t('subscription.statusExpired'),
        past_due: t('subscription.statusPastDue'),
        pending: t('subscription.statusPending'),
        free: t('subscription.statusFree')
    };

    const fetchSubscription = useCallback(async () => {
        setIsLoading(true);
        setError(false);

        try {
            const result = await userApi.getSubscription();

            if (result.ok && result.data) {
                setData(result.data.subscription);
            } else {
                setError(true);
            }
        } catch (err) {
            setError(true);
            webLogger.error('Error fetching subscription:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    // Loading state
    if (isLoading) {
        return (
            <output
                className="block rounded-lg border border-border p-6"
                aria-busy="true"
                aria-label={t('subscription.loading')}
            >
                <span className="sr-only">{t('subscription.loading')}</span>

                {/* Skeleton placeholder matching the loaded state height */}
                <div className="animate-pulse space-y-4">
                    {/* Plan name skeleton */}
                    <div className="h-6 w-1/3 rounded bg-surface-alt" />

                    {/* Status badge skeleton */}
                    <div className="h-5 w-20 rounded bg-surface-alt" />

                    {/* Price skeleton */}
                    <div className="h-8 w-1/4 rounded bg-surface-alt" />

                    {/* Divider */}
                    <div className="border-border border-t" />

                    {/* Features heading skeleton */}
                    <div className="h-4 w-2/5 rounded bg-surface-alt" />

                    {/* Feature list skeleton */}
                    <div className="space-y-2">
                        {SKELETON_FEATURE_KEYS.map((key) => (
                            <div
                                key={key}
                                className="flex items-center gap-2"
                            >
                                <div className="h-3 w-3 shrink-0 rounded-full bg-surface-alt" />
                                <div className="h-3 w-3/5 rounded bg-surface-alt" />
                            </div>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="border-border border-t" />

                    {/* Upgrade section skeleton */}
                    <div className="space-y-2">
                        <div className="h-5 w-1/4 rounded bg-surface-alt" />
                        <div className="h-4 w-4/5 rounded bg-surface-alt" />
                        <div className="mt-2 h-10 w-28 rounded bg-surface-alt" />
                    </div>
                </div>

                {/* Visible loading text below skeleton */}
                <div className="mt-6 flex items-center gap-3 border-border border-t pt-4">
                    <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-primary border-b-2" />
                    <span className="text-sm text-text-secondary">{t('subscription.loading')}</span>
                </div>
            </output>
        );
    }

    // Error state with retry button
    if (error) {
        return (
            <div
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-6"
                role="alert"
            >
                <div className="flex flex-col items-center gap-4 text-center">
                    <AlertTriangleIcon
                        size="lg"
                        weight="fill"
                        className="text-destructive"
                        aria-hidden="true"
                    />
                    <p className="font-medium text-destructive text-sm">
                        {t('subscription.loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={fetchSubscription}
                        aria-label={tUi('accessibility.retryLoading')}
                        className="inline-flex items-center gap-2 rounded-md border border-error/30 bg-surface px-4 py-2 font-medium text-error text-sm transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
                    >
                        <RefreshIcon
                            size="xs"
                            weight="bold"
                            aria-hidden="true"
                        />
                        {t('subscription.retry')}
                    </button>
                </div>
            </div>
        );
    }

    // Loaded state
    return (
        <div className="rounded-lg border border-border p-6 shadow-sm">
            {data !== null ? (
                <SubscriptionActiveView
                    subscription={data}
                    locale={locale}
                    upgradeHref={upgradeHref}
                    t={t}
                    features={features}
                    statusLabels={statusLabels}
                    onChangePlan={onChangePlan}
                    onCancelSubscription={onCancelSubscription}
                    onReactivate={onReactivate}
                    onUpdatePayment={onUpdatePayment}
                />
            ) : (
                <SubscriptionFreePlanView
                    upgradeHref={upgradeHref}
                    t={t}
                    features={features}
                    statusLabels={statusLabels}
                />
            )}
        </div>
    );
}

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { billingApi } from '../../lib/api/endpoints-protected';
import type { UsageSummary } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Props for the UsageOverview component
 */
export interface UsageOverviewProps {
    /** Locale for i18n */
    readonly locale: SupportedLocale;
}

/** Thresholds for progress bar color coding */
const THRESHOLD_WARNING = 80;
const THRESHOLD_DANGER = 90;

/**
 * Compute the usage percentage for a limit item.
 * Returns null when max is null (unlimited).
 */
function getUsagePercent(current: number, max: number | null): number | null {
    if (max === null || max === 0) return null;
    return Math.min(Math.round((current / max) * 100), 100);
}

/**
 * Returns the Tailwind color classes for a usage bar based on percentage.
 */
function getBarColor(percent: number): string {
    if (percent >= THRESHOLD_DANGER) return 'bg-red-500 dark:bg-red-600';
    if (percent >= THRESHOLD_WARNING) return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-green-500 dark:bg-green-400';
}

/**
 * Returns the text color class for a usage percentage.
 */
function getTextColor(percent: number): string {
    if (percent >= THRESHOLD_DANGER) return 'text-red-600 dark:text-red-400';
    if (percent >= THRESHOLD_WARNING) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-text-secondary';
}

/**
 * Usage overview section for the user billing dashboard.
 * Shows plan limit progress bars with color-coded warnings.
 *
 * @example
 * ```tsx
 * <UsageOverview locale="es" />
 * ```
 */
export function UsageOverview({ locale }: UsageOverviewProps) {
    const { t } = useTranslation({ locale, namespace: 'account' });

    const [usage, setUsage] = useState<UsageSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    /** Fetch usage summary from the API */
    const fetchUsage = useCallback(async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const result = await billingApi.getUsageSummary();
            if (result.ok && result.data) {
                setUsage(result.data);
            } else {
                setHasError(true);
            }
        } catch {
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    return (
        <section aria-labelledby="usage-heading">
            <h2
                id="usage-heading"
                className="mb-4 font-semibold text-lg text-text"
            >
                {t('subscription.usageTitle')}
            </h2>

            {/* Loading skeleton */}
            {isLoading && (
                <div
                    className="space-y-4"
                    aria-busy="true"
                    aria-label={t('subscription.loading')}
                >
                    {(['sk-usage-0', 'sk-usage-1', 'sk-usage-2'] as const).map((id) => (
                        <div
                            key={id}
                            className="space-y-2"
                        >
                            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-alt" />
                            <div className="h-3 animate-pulse rounded-full bg-surface-alt" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error state */}
            {!isLoading && hasError && (
                <div className="rounded-lg border border-border p-6 text-center">
                    <p className="mb-3 text-sm text-text-secondary">
                        {t('subscription.loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={fetchUsage}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        {t('subscription.retry')}
                    </button>
                </div>
            )}

            {/* Usage metrics */}
            {!isLoading && !hasError && usage && (
                <div className="space-y-5">
                    {usage.limits.map((limit) => {
                        const percent = getUsagePercent(limit.current, limit.max);
                        const isUnlimited = limit.max === null;
                        const isAtLimit = percent !== null && percent >= 100;
                        const isWarning = percent !== null && percent >= THRESHOLD_WARNING;

                        return (
                            <div
                                key={limit.key}
                                className="space-y-1.5"
                            >
                                {/* Label row */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-sm text-text">
                                        {limit.label}
                                    </span>
                                    <span
                                        className={`text-sm tabular-nums ${percent !== null ? getTextColor(percent) : 'text-text-secondary'}`}
                                    >
                                        {isUnlimited
                                            ? t('subscription.usageUnlimited')
                                            : t('subscription.usageOf', undefined, {
                                                  current: limit.current,
                                                  max: limit.max
                                              })}
                                    </span>
                                </div>

                                {/* Progress bar (hidden for unlimited) */}
                                {!isUnlimited && percent !== null && (
                                    <div
                                        className="h-2 w-full overflow-hidden rounded-full bg-surface-alt"
                                        role="progressbar"
                                        tabIndex={0}
                                        aria-valuenow={limit.current}
                                        aria-valuemin={0}
                                        aria-valuemax={limit.max ?? undefined}
                                        aria-label={limit.label}
                                    >
                                        <div
                                            className={`h-full rounded-full transition-all ${getBarColor(percent)}`}
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                )}

                                {/* Warning / limit messages */}
                                {!isUnlimited && isAtLimit && (
                                    <p className="text-red-600 text-xs dark:text-red-400">
                                        {t('subscription.usageAtLimit')}
                                    </p>
                                )}
                                {!isUnlimited && isWarning && !isAtLimit && (
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                        {t('subscription.usageWarning')}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

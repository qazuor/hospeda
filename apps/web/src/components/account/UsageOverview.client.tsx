import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { UsageSummary } from '../../lib/api/endpoints-protected';
import { billingApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Props for the UsageOverview component.
 */
export interface UsageOverviewProps {
    /** Locale for i18n */
    readonly locale: SupportedLocale;
}

/** Threshold percentage at which a usage bar turns yellow (warning). */
const THRESHOLD_WARNING = 80;

/** Threshold percentage at which a usage bar turns red (danger). */
const THRESHOLD_DANGER = 90;

/** Stable skeleton row keys for the loading state (avoids index key lint warning). */
const SKELETON_ROW_KEYS = ['sk-usage-0', 'sk-usage-1', 'sk-usage-2'] as const;

/**
 * Compute the usage percentage for a limit item.
 * Returns `null` when `max` is `null` (unlimited) or zero.
 *
 * @param current - Current usage count.
 * @param max - Maximum allowed usage, or `null` for unlimited.
 * @returns Integer percentage clamped to [0, 100], or `null`.
 */
function getUsagePercent(current: number, max: number | null): number | null {
    if (max === null || max === 0) return null;
    return Math.min(Math.round((current / max) * 100), 100);
}

/**
 * Returns the Tailwind fill-color classes for a progress bar based on percentage.
 * Uses semantic color tokens which already adapt to dark mode via CSS custom properties.
 *
 * @param percent - Usage percentage (0–100).
 * @returns Tailwind class string for `bg-*`.
 */
function getBarColor(percent: number): string {
    if (percent >= THRESHOLD_DANGER) return 'bg-destructive';
    if (percent >= THRESHOLD_WARNING) return 'bg-warning';
    return 'bg-primary';
}

/**
 * Returns the Tailwind text-color class for a usage percentage label.
 *
 * @param percent - Usage percentage (0–100).
 * @returns Tailwind class string for `text-*`.
 */
function getTextColor(percent: number): string {
    if (percent >= THRESHOLD_DANGER) return 'text-destructive';
    if (percent >= THRESHOLD_WARNING) return 'text-warning-foreground';
    return 'text-muted-foreground';
}

/**
 * Usage overview section for the user billing dashboard.
 * Fetches plan-limit data from the protected API and renders color-coded
 * progress bars with accessible ARIA roles.
 *
 * - Green bars: usage below 80 %
 * - Yellow bars: usage at 80–89 %
 * - Red bars: usage at 90 % or above
 * - No bar rendered for unlimited limits
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

    /**
     * Fetch usage summary from the protected billing endpoint.
     * Wrapped in `useCallback` so it can safely be passed to the retry button.
     */
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
                className="mb-4 font-semibold text-foreground text-lg"
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
                    {SKELETON_ROW_KEYS.map((id) => (
                        <div
                            key={id}
                            className="space-y-2"
                        >
                            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                            <div className="h-3 animate-pulse rounded-full bg-muted" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error state */}
            {!isLoading && hasError && (
                <div className="rounded-lg border border-border p-6 text-center">
                    <p className="mb-3 text-muted-foreground text-sm">
                        {t('subscription.loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={fetchUsage}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
                                    <span className="font-medium text-foreground text-sm">
                                        {limit.label}
                                    </span>
                                    <span
                                        className={`text-sm tabular-nums ${percent !== null ? getTextColor(percent) : 'text-muted-foreground'}`}
                                    >
                                        {isUnlimited
                                            ? t('subscription.usageUnlimited')
                                            : t('subscription.usageOf', undefined, {
                                                  current: limit.current,
                                                  max: limit.max
                                              })}
                                    </span>
                                </div>

                                {/* Progress bar (hidden for unlimited limits) */}
                                {!isUnlimited && percent !== null && (
                                    <div
                                        className="h-2 w-full overflow-hidden rounded-full bg-muted"
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

                                {/* At-limit warning message */}
                                {!isUnlimited && isAtLimit && (
                                    <p className="text-destructive text-xs">
                                        {t('subscription.usageAtLimit')}
                                    </p>
                                )}

                                {/* Approaching-limit warning message */}
                                {!isUnlimited && isWarning && !isAtLimit && (
                                    <p className="text-warning-foreground text-xs">
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

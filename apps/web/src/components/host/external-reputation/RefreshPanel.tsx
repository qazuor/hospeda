/**
 * @file RefreshPanel.tsx
 * @description Refresh button, its feedback and the rate-limit message of the
 * external reputation section (HOS-2515).
 *
 * The button is disabled while a refresh is running, while any platform still
 * has an async run in flight (OQ-4) and while no platform is connected
 * (HOS-1944). Its idle («Actualizar reseñas») and busy («Actualizando…») labels
 * are DISTINCT i18n keys (HOS-2438).
 */

import type { ReactElement } from 'react';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import styles from './ExternalReputation.module.css';
import type { ReputationMeta } from './external-reputation-types';
import type { UseReputationRefreshResult } from './use-reputation-refresh';

/** Props of {@link RefreshPanel}. */
export interface RefreshPanelProps {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    readonly tPlural: (key: string, count: number, params?: Record<string, unknown>) => string;
    readonly refresh: UseReputationRefreshResult;
    readonly aggregateFetchedAt: ReputationMeta['aggregateFetchedAt'];
    /** True once the listings loaded and there is none: nothing to refresh. */
    readonly hasNoPlatforms: boolean;
}

/**
 * The refresh area.
 *
 * @param props - See {@link RefreshPanelProps}.
 * @returns The feedback, the button and the secondary lines.
 */
export function RefreshPanel({
    locale,
    t,
    tPlural,
    refresh,
    aggregateFetchedAt,
    hasNoPlatforms
}: RefreshPanelProps): ReactElement {
    const { feedback, rateLimitMinutes, refreshError, isRefreshing, allSettled } = refresh;
    return (
        <>
            {feedback === 'enqueued' && (
                <Alert
                    tone="info"
                    locale={locale}
                >
                    {t('external-reputation.refresh.enqueued')}
                </Alert>
            )}
            {feedback === 'noPlatforms' && (
                <div data-testid="refresh-no-platforms">
                    <Alert
                        tone="info"
                        locale={locale}
                    >
                        {t('external-reputation.refresh.noPlatforms')}
                    </Alert>
                </div>
            )}
            {feedback === 'inlineSuccess' && (
                <Alert
                    tone="success"
                    locale={locale}
                >
                    {t('external-reputation.refresh.inlineSuccess')}
                </Alert>
            )}

            <div className={styles.refreshRow}>
                <Button
                    variant="secondary"
                    loading={isRefreshing}
                    disabled={isRefreshing || !allSettled || hasNoPlatforms}
                    onClick={() => void refresh.refresh()}
                    data-testid="refresh-button"
                >
                    {isRefreshing
                        ? t('external-reputation.ownerConfig.refreshing')
                        : t('external-reputation.ownerConfig.refresh')}
                </Button>

                {hasNoPlatforms && (
                    <p
                        className={styles.refreshMeta}
                        data-testid="refresh-needs-platform"
                    >
                        {t('external-reputation.refresh.needsPlatform')}
                    </p>
                )}

                {aggregateFetchedAt && rateLimitMinutes === null && (
                    <p className={styles.refreshMeta}>
                        {t('external-reputation.ownerConfig.lastUpdated', undefined, {
                            date: aggregateFetchedAt.toLocaleString(locale)
                        })}
                    </p>
                )}
            </div>

            {rateLimitMinutes !== null && (
                <div data-testid="rate-limit-msg">
                    <Alert
                        tone="warning"
                        locale={locale}
                    >
                        {tPlural('external-reputation.ownerConfig.rateLimitHit', rateLimitMinutes, {
                            minutes: rateLimitMinutes
                        })}
                    </Alert>
                </div>
            )}

            {refreshError !== null && rateLimitMinutes === null && (
                <Alert
                    tone="danger"
                    locale={locale}
                >
                    {refreshError}
                </Alert>
            )}
        </>
    );
}

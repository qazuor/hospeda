/**
 * @file ResponseRateWidget.client.tsx
 * @description React island showing response rate as a circular progress
 * indicator with percentage and average response time.
 *
 * @example
 * ```astro
 * <ResponseRateWidget client:load locale={locale} data={responseRateData} isLoading={false} error={null} />
 * ```
 */

import type { ResponseRateData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { JSX } from 'react';
import styles from './ResponseRateWidget.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResponseRateWidgetProps {
    readonly locale: SupportedLocale;
    readonly data: ResponseRateData | undefined;
    readonly isLoading: boolean;
    readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SVG circle progress radius and circumference for the circular indicator */
const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ResponseRateWidget — KPI card with circular progress + avg response time.
 *
 * @example
 * ```astro
 * <ResponseRateWidget client:load locale={locale} data={data} isLoading={false} error={null} />
 * ```
 */
export function ResponseRateWidget({
    locale,
    data,
    isLoading,
    error
}: ResponseRateWidgetProps): JSX.Element {
    const { t } = createTranslations(locale);

    // ── Loading skeleton ────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.responseRate.title', 'Tiempo de respuesta')}
                    </h3>
                </div>
                <div
                    className={styles.skeleton}
                    data-testid="response-rate-skeleton"
                    aria-hidden="true"
                />
            </div>
        );
    }

    // ── Error state ─────────────────────────────────────────────────────
    if (error) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.responseRate.title', 'Tiempo de respuesta')}
                    </h3>
                </div>
                <div
                    className={styles.error}
                    role="alert"
                >
                    <p className={styles.errorText}>{error}</p>
                </div>
            </div>
        );
    }

    // ── Empty state ─────────────────────────────────────────────────────
    if (!data) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.responseRate.title', 'Tiempo de respuesta')}
                    </h3>
                </div>
                <div className={styles.empty}>
                    <p>
                        {t(
                            'host.dashboard.analytics.responseRate.empty',
                            'Sin datos de respuesta aún'
                        )}
                    </p>
                </div>
            </div>
        );
    }

    // ── Circular progress ───────────────────────────────────────────────
    const pct = Math.min(100, Math.max(0, data.responseRatePct));
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
    const avgTime =
        data.avgResponseTimeMinutes != null
            ? `${data.avgResponseTimeMinutes} ${t('host.dashboard.analytics.responseRate.minutes', 'min')}`
            : t('host.dashboard.analytics.responseRate.notAvailable', 'N/A');

    return (
        <div className={styles.widget}>
            <div className={styles.header}>
                <h3 className={styles.title}>
                    {t('host.dashboard.analytics.responseRate.title', 'Tiempo de respuesta')}
                </h3>
            </div>
            <div className={styles.content}>
                <div className={styles.circleWrapper}>
                    <svg
                        className={styles.circleSvg}
                        viewBox="0 0 100 100"
                        aria-hidden="true"
                    >
                        <circle
                            className={styles.circleTrack}
                            cx="50"
                            cy="50"
                            r={RADIUS}
                        />
                        <circle
                            className={styles.circleFill}
                            cx="50"
                            cy="50"
                            r={RADIUS}
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={offset}
                        />
                    </svg>
                    <span className={styles.circleText}>{pct}%</span>
                </div>
                <div className={styles.meta}>
                    <span className={styles.avgLabel}>
                        {t('host.dashboard.analytics.responseRate.avgTime', 'Promedio')}
                    </span>
                    <span className={styles.avgValue}>{avgTime}</span>
                </div>
            </div>
        </div>
    );
}

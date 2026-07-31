/**
 * @file PlanUsageSection.client.tsx
 * @description Shows how much of each limit of the current plan the user has
 * consumed, on /mi-cuenta/suscripcion/.
 *
 * Data comes from `GET /protected/billing/usage`, fetched after hydration.
 * The page is authenticated and non-indexable, so there is no crawler to serve
 * an SSR value to; fetching here keeps the usage query (which counts
 * accommodations, favourites, collections and AI meters) off the page's TTFB.
 */

import { useEffect, useState } from 'react';
import type { LimitUsage, UsageThresholdLevel } from '@/lib/api/endpoints-protected';
import { billingApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PlanUsageSection.module.css';

/** Props for the PlanUsageSection island */
export interface PlanUsageSectionProps {
    /** Active locale for UI strings */
    readonly locale: SupportedLocale;
    /**
     * Which subscription's limits to report on (HOS-259). A dual-role owner
     * can hold both an accommodation and a commerce subscription under one
     * billing customer, and each grants a different set of limits.
     */
    readonly productDomain?: 'accommodation' | 'commerce';
}

/** `maxAllowed` sentinel meaning "no ceiling" (staff bypass sets it on every key). */
const UNLIMITED = -1;

/**
 * Maps a threshold level to its CSS module class.
 *
 * @param threshold - Server-computed threshold for one limit
 * @returns CSS module class key, or `undefined` for the default (`ok`) level
 */
function getThresholdClass(threshold: UsageThresholdLevel): string | undefined {
    switch (threshold) {
        case 'warning':
            return styles.barFillWarning;
        case 'critical':
        case 'exceeded':
            return styles.barFillCritical;
        default:
            return undefined;
    }
}

/**
 * Renders a single limit row: its name, the consumption figure, and — when the
 * limit has a real ceiling — a progress bar.
 */
function LimitRow({
    limit,
    locale
}: {
    readonly limit: LimitUsage;
    readonly locale: SupportedLocale;
}) {
    const { t } = createTranslations(locale);

    // Translate by `limitKey`, never by the API's `displayName`: that field
    // comes from `LIMIT_METADATA` and is hardcoded English.
    const label = t(`account.subscription.usage.limits.${limit.limitKey}`, limit.displayName);

    const isUnlimited = limit.maxAllowed === UNLIMITED;
    const labelId = `plan-usage-label-${limit.limitKey}`;

    // The API reports a real percentage, which can exceed 100 after a
    // downgrade or an addon expiry. Cap the BAR at 100% while the figure next
    // to it still tells the truth.
    const barPercentage = Math.min(100, Math.max(0, limit.usagePercentage));

    // The server's `exceeded` threshold starts at 100%, which lumps together
    // "you are at your limit" and "you are over it". Saying "superaste el
    // límite" to someone sitting at exactly 1 de 1 is simply false, so split
    // the two on the raw figures rather than on the threshold alone.
    const thresholdNotice =
        limit.threshold === 'exceeded'
            ? limit.currentUsage > limit.maxAllowed
                ? t('account.subscription.usage.thresholdExceeded', 'Límite superado')
                : t('account.subscription.usage.thresholdReached', 'Llegaste al límite')
            : limit.threshold === 'critical'
              ? t('account.subscription.usage.thresholdCritical', 'Casi sin margen')
              : limit.threshold === 'warning'
                ? t('account.subscription.usage.thresholdWarning', 'Cerca del límite')
                : null;

    return (
        <li className={styles.item}>
            <div className={styles.itemHeader}>
                <span
                    className={styles.itemLabel}
                    id={labelId}
                >
                    {label}
                </span>
                <span className={styles.itemValue}>
                    {isUnlimited
                        ? `${t('account.subscription.usage.unlimitedUsage', '{{current}} en uso', { current: limit.currentUsage })} · ${t('account.subscription.usage.unlimited', 'Ilimitado')}`
                        : t('account.subscription.usage.ofMax', '{{current}} de {{max}}', {
                              current: limit.currentUsage,
                              max: limit.maxAllowed
                          })}
                </span>
            </div>

            {/* An unlimited limit gets no bar: a bar with no ceiling either
                reads as "0% used" (false) or "full" (also false). */}
            {!isUnlimited && (
                <div
                    className={styles.bar}
                    role="progressbar"
                    aria-labelledby={labelId}
                    aria-valuenow={limit.currentUsage}
                    aria-valuemin={0}
                    aria-valuemax={limit.maxAllowed}
                >
                    <div
                        className={`${styles.barFill} ${getThresholdClass(limit.threshold) ?? ''}`}
                        style={{ width: `${barPercentage}%` }}
                    />
                </div>
            )}

            {thresholdNotice && !isUnlimited && (
                <p className={styles.itemNotice}>{thresholdNotice}</p>
            )}

            {limit.addonBonusLimit > 0 && (
                <p className={styles.itemHint}>
                    {t(
                        'account.subscription.usage.addonBonus',
                        'Incluye {{bonus}} extra por complementos',
                        { bonus: limit.addonBonusLimit }
                    )}
                </p>
            )}
        </li>
    );
}

/**
 * Plan-usage section for the subscription dashboard.
 *
 * Renders nothing at all — no empty card, no error box — when there is no
 * usage to show. The endpoint answers `404` for a user with no subscription in
 * the domain and `503` where billing is not configured, and neither is
 * something to report to the user on this page: the surrounding dashboard
 * already tells them what their subscription state is.
 *
 * @param props - Locale and the product domain to scope the query to
 * @returns The usage section, or `null` when there is nothing to display
 */
export function PlanUsageSection({ locale, productDomain }: PlanUsageSectionProps) {
    const { t } = createTranslations(locale);

    const [limits, setLimits] = useState<readonly LimitUsage[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            try {
                const result = await billingApi.getUsage({ productDomain });
                if (cancelled) return;

                // Degrade silently: a failed usage read must never take the
                // subscription page down with it.
                setLimits(result.ok ? result.data.limits : null);
            } catch {
                if (!cancelled) setLimits(null);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [productDomain]);

    if (isLoading) {
        return (
            <section
                className={styles.root}
                aria-busy="true"
            >
                <h3 className={styles.title}>
                    {t('account.subscription.usage.title', 'Uso de tu plan')}
                </h3>
                <p className={styles.loading}>
                    {t('account.subscription.usage.loading', 'Cargando el uso de tu plan...')}
                </p>
            </section>
        );
    }

    // Two independent reasons to drop a row:
    // - `maxAllowed === 0`: the plan does not grant this limit at all. The
    //   endpoint returns EVERY LimitKey, so without this the user sees a wall
    //   of "0 de 0" rows for features they do not have.
    // - `!isMeasured`: the server has no counter for this key and reports a
    //   placeholder `0`. Showing it would state, as fact, that the user has
    //   consumed nothing — false for anyone who has used the feature.
    const visibleLimits = (limits ?? []).filter(
        (limit) => limit.maxAllowed !== 0 && limit.isMeasured
    );

    if (visibleLimits.length === 0) {
        return null;
    }

    return (
        <section
            className={styles.root}
            aria-label={t('account.subscription.usage.title', 'Uso de tu plan')}
        >
            <h3 className={styles.title}>
                {t('account.subscription.usage.title', 'Uso de tu plan')}
            </h3>
            <p className={styles.subtitle}>
                {t(
                    'account.subscription.usage.subtitle',
                    'Cuánto consumiste de cada límite incluido en tu plan.'
                )}
            </p>

            <ul className={styles.list}>
                {visibleLimits.map((limit) => (
                    <LimitRow
                        key={limit.limitKey}
                        limit={limit}
                        locale={locale}
                    />
                ))}
            </ul>
        </section>
    );
}

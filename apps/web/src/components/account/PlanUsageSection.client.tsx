/**
 * @file PlanUsageSection.client.tsx
 * @description Shows what the user has consumed of every limit their plan
 * grants, on /mi-cuenta/suscripcion/, grouped by audience (host / traveller).
 *
 * Data comes from `GET /protected/billing/usage`, fetched after hydration.
 * The page is authenticated and non-indexable, so there is no crawler to serve
 * an SSR value to; fetching here keeps the usage queries off the page's TTFB.
 *
 * Each row renders according to the server's `usageKind` — see
 * {@link LimitRow}. Rows near their ceiling also offer the ways out (upgrade
 * the plan, or buy the add-on that raises that specific limit).
 */

import { useEffect, useState } from 'react';
import { resolveSubscriptionPlansPath } from '@/lib/account-roles';
import type { AccommodationPhotoUsage, LimitUsage } from '@/lib/api/endpoints-protected';
import { billingApi } from '@/lib/api/endpoints-protected';
import type { ProductDomainScope } from '@/lib/api/types';
import {
    addonSlugForLimit,
    groupLimitsByAudience,
    needsUpgradePrompt,
    type UsageAudience
} from '@/lib/billing/plan-usage-config';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './PlanUsageSection.module.css';

/** Props for the PlanUsageSection island */
export interface PlanUsageSectionProps {
    /** Active locale for UI strings */
    readonly locale: SupportedLocale;
    /** Every role the user holds — decides which pricing page the CTA points at. */
    readonly roles: readonly string[];
    /**
     * Which subscription's limits to report on (HOS-259). A dual-role owner
     * can hold both an accommodation and a commerce subscription under one
     * billing customer, and each grants a different set of limits.
     */
    readonly productDomain?: ProductDomainScope;
}

/** `maxAllowed` sentinel meaning "no ceiling". */
const UNLIMITED = -1;

/**
 * Maps a threshold level to its bar-fill CSS class.
 *
 * @param threshold - Server-computed threshold for one limit
 * @returns CSS module class, or `undefined` for the default (`ok`) level
 */
function getThresholdClass(threshold: LimitUsage['threshold']): string | undefined {
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
 * A progress bar with an accessible name.
 *
 * The fill is capped at 100% while the caller's figure keeps reporting the
 * truth — usage can legitimately exceed the ceiling after a downgrade or an
 * add-on expiry.
 */
function UsageBar({
    current,
    max,
    threshold,
    labelledBy
}: {
    readonly current: number;
    readonly max: number;
    readonly threshold: LimitUsage['threshold'];
    readonly labelledBy: string;
}) {
    const percentage = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;

    return (
        <div
            className={styles.bar}
            role="progressbar"
            aria-labelledby={labelledBy}
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={max}
        >
            <div
                className={`${styles.barFill} ${getThresholdClass(threshold) ?? ''}`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

/**
 * The "you are running out" notice for a row.
 *
 * The server buckets 100% as `exceeded`, which conflates "at your limit" with
 * "over it" — telling someone sitting at exactly 1 de 1 that they exceeded it
 * is false, so the wording is decided by the raw figures.
 *
 * @returns The notice text, or `null` when the row is comfortably under.
 */
function thresholdNotice({
    limit,
    t
}: {
    readonly limit: LimitUsage;
    readonly t: ReturnType<typeof createTranslations>['t'];
}): string | null {
    switch (limit.threshold) {
        case 'exceeded':
            return limit.currentUsage > limit.maxAllowed
                ? t('account.subscription.usage.thresholdExceeded', 'Límite superado')
                : t('account.subscription.usage.thresholdReached', 'Llegaste al límite');
        case 'critical':
            return t('account.subscription.usage.thresholdCritical', 'Casi sin margen');
        case 'warning':
            return t('account.subscription.usage.thresholdWarning', 'Cerca del límite');
        default:
            return null;
    }
}

/**
 * The ways to raise a limit: the add-on that targets it (when one is
 * purchasable) and the plan upgrade. Only rendered for rows that are actually
 * running out — see `needsUpgradePrompt`.
 */
function UpgradeActions({
    limit,
    locale,
    roles
}: {
    readonly limit: LimitUsage;
    readonly locale: SupportedLocale;
    readonly roles: readonly string[];
}) {
    const { t } = createTranslations(locale);
    const addonSlug = addonSlugForLimit(limit.limitKey);

    const plansHref = buildUrl({ locale, path: resolveSubscriptionPlansPath({ roles }) });
    const addonsHref = `${buildUrl({ locale, path: 'mi-cuenta/addons' })}#addon-${addonSlug}`;

    return (
        <p className={styles.actions}>
            {addonSlug && (
                <a
                    className={styles.actionLink}
                    href={addonsHref}
                >
                    {t('account.subscription.usage.buyAddon', 'Ampliar con un complemento')}
                </a>
            )}
            <a
                className={styles.actionLink}
                href={plansHref}
            >
                {t('account.subscription.usage.upgradePlan', 'Mejorar mi plan')}
            </a>
        </p>
    );
}

/**
 * The per-accommodation breakdown of a photo cap.
 *
 * A per-accommodation limit has no account-wide figure, so the honest display
 * is one row per accommodation — which is also what tells the owner WHICH
 * listing is about to reject its next upload.
 */
function PerAccommodationRows({
    entries,
    max,
    locale
}: {
    readonly entries: readonly AccommodationPhotoUsage[] | undefined;
    readonly max: number;
    readonly locale: SupportedLocale;
}) {
    const { t } = createTranslations(locale);

    // Absent (the server could not build it) is NOT the same as empty. Only an
    // empty list is evidence that the user has no accommodations; claiming it
    // after a failed read would state something false.
    if (entries === undefined) {
        return null;
    }

    if (entries.length === 0) {
        return (
            <p className={styles.itemHint}>
                {t(
                    'account.subscription.usage.perAccommodationEmpty',
                    'Todavía no publicaste ningún alojamiento.'
                )}
            </p>
        );
    }

    return (
        <ul className={styles.subList}>
            {entries.map((entry) => {
                const labelId = `plan-usage-accommodation-${entry.accommodationId}`;

                return (
                    <li
                        key={entry.accommodationId}
                        className={styles.subItem}
                    >
                        <div className={styles.itemHeader}>
                            <span
                                className={styles.subLabel}
                                id={labelId}
                            >
                                {entry.name}
                            </span>
                            <span className={styles.itemValue}>
                                {t('account.subscription.usage.ofMax', '{{current}} de {{max}}', {
                                    current: entry.currentUsage,
                                    max
                                })}
                            </span>
                        </div>
                        {max !== UNLIMITED && (
                            <UsageBar
                                current={entry.currentUsage}
                                max={max}
                                threshold={
                                    entry.currentUsage >= max
                                        ? 'exceeded'
                                        : entry.currentUsage / max >= 0.8
                                          ? 'warning'
                                          : 'ok'
                                }
                                labelledBy={labelId}
                            />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * One limit row, rendered according to its `usageKind`.
 *
 * - `stock` / `monthly` — consumption figure plus a bar (or "Ilimitado").
 * - `per_accommodation` — the cap, then one sub-row per accommodation.
 * - `per_operation` — the cap alone. Nothing is stored, so there is no
 *   consumption; showing "0 de 4" would invent one.
 */
function LimitRow({
    limit,
    locale,
    roles
}: {
    readonly limit: LimitUsage;
    readonly locale: SupportedLocale;
    readonly roles: readonly string[];
}) {
    const { t } = createTranslations(locale);

    // Translate by `limitKey`, never the API's `displayName`: that field comes
    // from `LIMIT_METADATA` and is hardcoded English.
    const label = t(`account.subscription.usage.limits.${limit.limitKey}`, limit.displayName);
    const labelId = `plan-usage-label-${limit.limitKey}`;

    const isUnlimited = limit.maxAllowed === UNLIMITED;
    const isCountable = limit.usageKind === 'stock' || limit.usageKind === 'monthly';
    const notice = isCountable && !isUnlimited ? thresholdNotice({ limit, t }) : null;

    /** The right-hand figure, which differs per kind. */
    const value = (() => {
        if (isUnlimited) {
            return `${t('account.subscription.usage.unlimitedUsage', '{{current}} en uso', {
                current: limit.currentUsage
            })} · ${t('account.subscription.usage.unlimited', 'Ilimitado')}`;
        }

        if (isCountable) {
            return t('account.subscription.usage.ofMax', '{{current}} de {{max}}', {
                current: limit.currentUsage,
                max: limit.maxAllowed
            });
        }

        // per_accommodation / per_operation: the cap is the only true figure.
        return t('account.subscription.usage.capOnly', 'Hasta {{max}}', {
            max: limit.maxAllowed
        });
    })();

    return (
        <li className={styles.item}>
            <div className={styles.itemHeader}>
                <span
                    className={styles.itemLabel}
                    id={labelId}
                >
                    {label}
                </span>
                <span className={styles.itemValue}>{value}</span>
            </div>

            {/* A bar needs both a ceiling and a real measurement behind it. */}
            {isCountable && !isUnlimited && (
                <UsageBar
                    current={limit.currentUsage}
                    max={limit.maxAllowed}
                    threshold={limit.threshold}
                    labelledBy={labelId}
                />
            )}

            {limit.usageKind === 'per_accommodation' && (
                <PerAccommodationRows
                    entries={limit.perAccommodation}
                    max={limit.maxAllowed}
                    locale={locale}
                />
            )}

            {notice && <p className={styles.itemNotice}>{notice}</p>}

            {limit.addonBonusLimit > 0 && (
                <p className={styles.itemHint}>
                    {t(
                        'account.subscription.usage.addonBonus',
                        'Incluye {{bonus}} extra por complementos',
                        { bonus: limit.addonBonusLimit }
                    )}
                </p>
            )}

            {needsUpgradePrompt(limit) && (
                <UpgradeActions
                    limit={limit}
                    locale={locale}
                    roles={roles}
                />
            )}
        </li>
    );
}

/**
 * Plan-usage section for the subscription dashboard.
 *
 * Renders nothing when there is no usage to show. The endpoint answers `404`
 * for a user with no subscription in the domain and `503` where billing is not
 * configured; neither is worth an error box here, because the surrounding
 * dashboard already states the subscription's status.
 *
 * @param props - Locale, the user's roles, and the domain to scope the query to
 * @returns The usage section, or `null` when there is nothing to display
 */
export function PlanUsageSection({ locale, roles, productDomain }: PlanUsageSectionProps) {
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

    const groups = groupLimitsByAudience(limits ?? []);

    if (groups.length === 0) {
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

            {groups.map((group) => (
                <section
                    key={group.audience}
                    className={styles.group}
                    aria-label={audienceLabel({ audience: group.audience, t })}
                >
                    <h4 className={styles.groupTitle}>
                        {audienceLabel({ audience: group.audience, t })}
                    </h4>

                    <ul className={styles.list}>
                        {group.limits.map((limit) => (
                            <LimitRow
                                key={limit.limitKey}
                                limit={limit}
                                locale={locale}
                                roles={roles}
                            />
                        ))}
                    </ul>

                    {group.limits.some((limit) => limit.usageKind === 'monthly') && (
                        <p className={styles.groupNote}>
                            {t(
                                'account.subscription.usage.monthlyNote',
                                'Se reinicia al comenzar cada mes.'
                            )}
                        </p>
                    )}
                </section>
            ))}
        </section>
    );
}

/**
 * Heading for an audience group.
 *
 * @param input.audience - The group's audience
 * @param input.t - Bound translation function
 * @returns The localized heading
 */
function audienceLabel({
    audience,
    t
}: {
    readonly audience: UsageAudience;
    readonly t: ReturnType<typeof createTranslations>['t'];
}): string {
    return audience === 'host'
        ? t('account.subscription.usage.audienceHost', 'Como anfitrión')
        : t('account.subscription.usage.audienceTraveler', 'Como viajero');
}

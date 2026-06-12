/**
 * @file HostDashboard.client.tsx
 * @description Host dashboard React island with 4 widget slots.
 *
 * Fetches data from the protected host dashboard endpoint on mount and
 * renders property summary, plan info, unread messages, and quick actions.
 *
 * @example
 * ```astro
 * <HostDashboard client:load locale={locale} />
 * ```
 */

import { hostDashboardApi } from '@/lib/api/endpoints-protected';
import { transformHostDashboard } from '@/lib/api/transforms';
import type { HostDashboardData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { BuildingIcon, ChatIcon, CreditCardIcon, MegaphoneIcon } from '@repo/icons';
import { type JSX, useCallback, useEffect, useState } from 'react';
import { AnalyticsSection } from './AnalyticsSection.client';
import styles from './HostDashboard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HostDashboardProps {
    /** Active UI locale for i18n and URL building */
    readonly locale: SupportedLocale;
}

type DashboardState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly data: HostDashboardData }
    | { readonly status: 'error'; readonly message: string };

// ---------------------------------------------------------------------------
// Quick action config
// ---------------------------------------------------------------------------

interface QuickAction {
    readonly key: string;
    readonly labelKey: string;
    readonly href: string;
    readonly icon: typeof BuildingIcon;
}

const QUICK_ACTIONS: ReadonlyArray<QuickAction> = [
    {
        key: 'properties',
        labelKey: 'host.dashboard.quickActions.properties',
        href: 'mi-cuenta/propiedades',
        icon: BuildingIcon
    },
    {
        key: 'promotions',
        labelKey: 'host.dashboard.quickActions.promotions',
        href: 'mi-cuenta/promociones',
        icon: MegaphoneIcon
    },
    {
        key: 'messages',
        labelKey: 'host.dashboard.quickActions.messages',
        href: 'mi-cuenta/consultas',
        icon: ChatIcon
    },
    {
        key: 'subscription',
        labelKey: 'host.dashboard.quickActions.subscription',
        href: 'mi-cuenta/suscripcion',
        icon: CreditCardIcon
    }
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Host dashboard island — shows aggregated host data in a 4-widget layout.
 *
 * @example
 * ```astro
 * <HostDashboard client:load locale={locale} />
 * ```
 */
export function HostDashboard({ locale }: HostDashboardProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<DashboardState>({ status: 'loading' });

    // ── Fetch dashboard data ──────────────────────────────────────────────
    // biome-ignore lint/correctness/useExhaustiveDependencies: t is a stable translation function bound to a fixed locale; including it would loop the effect (Maximum update depth)
    const fetchDashboard = useCallback(async () => {
        setState({ status: 'loading' });
        try {
            const result = await hostDashboardApi.get();
            if (!result.ok) {
                setState({
                    status: 'error',
                    message:
                        result.error.message ??
                        t('host.dashboard.error', 'Error al cargar el panel')
                });
                return;
            }
            // TYPE-WORKAROUND: api response shape not inferred from generic
            const data = transformHostDashboard({
                item: result.data as unknown as Record<string, unknown>
            });
            setState({ status: 'ready', data });
        } catch (err) {
            setState({
                status: 'error',
                message:
                    err instanceof Error
                        ? err.message
                        : t('host.dashboard.error', 'Error al cargar el panel')
            });
        }
    }, []);

    useEffect(() => {
        void fetchDashboard();
    }, [fetchDashboard]);

    // ── Render: loading ───────────────────────────────────────────────────
    if (state.status === 'loading') {
        return (
            <div className={styles.dashboard}>
                <div className={styles.skeletonGrid}>
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className={styles.skeletonWidget}
                            aria-hidden="true"
                        />
                    ))}
                </div>
            </div>
        );
    }

    // ── Render: error ─────────────────────────────────────────────────────
    if (state.status === 'error') {
        return (
            <div className={styles.dashboard}>
                <div
                    className={styles.errorWidget}
                    role="alert"
                >
                    <p className={styles.errorText}>{state.message}</p>
                    <button
                        type="button"
                        onClick={() => void fetchDashboard()}
                        className={styles.retryButton}
                    >
                        {t('host.dashboard.retry', 'Reintentar')}
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: ready ─────────────────────────────────────────────────────
    const { data } = state;

    const planBadge = data.planInfo
        ? data.planInfo.isTrial
            ? t('host.dashboard.plan.trial', 'Prueba gratuita')
            : data.planInfo.status === 'active'
              ? t('host.dashboard.plan.active', 'Activo')
              : t('host.dashboard.plan.inactive', 'Inactivo')
        : t('host.dashboard.plan.noPlan', 'Sin plan');

    return (
        <div className={styles.dashboard}>
            <div className={styles.widgetGrid}>
                {/* ── Widget 1: Property summary ── */}
                <div className={styles.widget}>
                    <h3 className={styles.widgetTitle}>
                        {t('host.dashboard.widgets.properties', 'Tus propiedades')}
                    </h3>
                    <div className={styles.statList}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>
                                {t('host.dashboard.widgets.total', 'Total')}
                            </span>
                            <span className={styles.statValue}>{data.propertySummary.total}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>
                                {t('host.dashboard.widgets.published', 'Publicadas')}
                            </span>
                            <span className={styles.statValueAccent}>
                                {data.propertySummary.published}
                            </span>
                        </div>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>
                                {t('host.dashboard.widgets.draft', 'Borradores')}
                            </span>
                            <span className={styles.statValueMuted}>
                                {data.propertySummary.draft}
                            </span>
                        </div>
                    </div>
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta/propiedades' })}
                        className={styles.widgetLink}
                    >
                        {t('host.dashboard.widgets.manage', 'Gestionar')}
                    </a>
                </div>

                {/* ── Widget 2: Plan info ── */}
                <div className={styles.widget}>
                    <h3 className={styles.widgetTitle}>
                        {t('host.dashboard.widgets.plan', 'Tu suscripción')}
                    </h3>
                    {data.planInfo ? (
                        <>
                            <p className={styles.planName}>{data.planInfo.name}</p>
                            <span
                                className={`${styles.planBadge} ${
                                    data.planInfo.isTrial || data.planInfo.status !== 'active'
                                        ? styles.planBadgeWarning
                                        : styles.planBadgeActive
                                }`}
                            >
                                {planBadge}
                            </span>
                        </>
                    ) : (
                        <p className={styles.planEmpty}>
                            {t('host.dashboard.widgets.noPlan', 'Sin suscripción activa')}
                        </p>
                    )}
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta/suscripcion' })}
                        className={styles.widgetLink}
                    >
                        {t('host.dashboard.widgets.manage', 'Gestionar')}
                    </a>
                </div>

                {/* ── Widget 3: Unread messages ── */}
                <div className={styles.widget}>
                    <h3 className={styles.widgetTitle}>
                        {t('host.dashboard.widgets.messages', 'Mensajes')}
                    </h3>
                    <p className={styles.messageCount}>
                        {data.unreadCount > 0 ? (
                            <>
                                <span className={styles.unreadBadge}>{data.unreadCount}</span>{' '}
                                {data.unreadCount === 1
                                    ? t(
                                          'host.dashboard.widgets.unread.singular',
                                          'mensaje sin leer'
                                      )
                                    : t(
                                          'host.dashboard.widgets.unread.plural',
                                          'mensajes sin leer'
                                      )}
                            </>
                        ) : (
                            t('host.dashboard.widgets.unread.none', 'No tenés mensajes nuevos')
                        )}
                    </p>
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta/consultas' })}
                        className={styles.widgetLink}
                    >
                        {t('host.dashboard.widgets.viewAll', 'Ver todos')}
                    </a>
                </div>

                {/* ── Widget 4: Quick actions ── */}
                <div className={styles.widget}>
                    <h3 className={styles.widgetTitle}>
                        {t('host.dashboard.widgets.quickActions', 'Acciones rápidas')}
                    </h3>
                    <ul className={styles.quickActionList}>
                        {QUICK_ACTIONS.map((action) => {
                            const Icon = action.icon;
                            return (
                                <li key={action.key}>
                                    <a
                                        href={buildUrl({ locale, path: action.href })}
                                        className={styles.quickActionLink}
                                    >
                                        <Icon
                                            size={18}
                                            aria-hidden="true"
                                        />
                                        <span>{t(action.labelKey, action.key)}</span>
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>

            {/* ── Analytics section ── */}
            <AnalyticsSection locale={locale} />
        </div>
    );
}

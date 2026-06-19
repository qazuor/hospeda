/**
 * @file PromotionList.client.tsx
 * @description React island that lists the authenticated owner's promotions
 * and allows deleting them with an inline confirmation step.
 *
 * Follows the same `loading | ready | error` state machine and hook discipline
 * as `HostDashboard.client.tsx`.
 *
 * @example
 * ```astro
 * <PromotionList client:load locale={locale} />
 * ```
 */

import { billingApi, ownerPromotionApi } from '@/lib/api/endpoints-protected';
import { transformOwnerPromotionList } from '@/lib/api/transforms';
import type { OwnerPromotionData, OwnerPromotionDiscountType } from '@/lib/api/types';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { type JSX, useCallback, useEffect, useState } from 'react';
import styles from './PromotionList.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Client-safe entitlement literal matching the backend wire value. Kept as a
 * plain string rather than imported from `@repo/billing` to avoid pulling
 * server-only deps into the client bundle (same convention as AnalyticsSection).
 */
const ENTITLEMENT_CREATE_PROMOTIONS = 'create_promotions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromotionListProps {
    /** Active UI locale for i18n and URL building */
    readonly locale: SupportedLocale;
}

type ListState =
    | { readonly status: 'loading' }
    | {
          readonly status: 'ready';
          readonly items: ReadonlyArray<OwnerPromotionData>;
          /**
           * Whether the actor's plan includes the `create_promotions`
           * entitlement. Gates the "new promotion" button so a host without it
           * sees an upgrade prompt instead of a button that only fails on save.
           */
          readonly canCreate: boolean;
      }
    | { readonly status: 'error'; readonly message: string };

/** Per-row delete state machine */
type DeleteState =
    | { readonly status: 'idle' }
    | { readonly status: 'confirming'; readonly id: string }
    | { readonly status: 'pending'; readonly id: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a human-readable discount summary given the type and value.
 * - `percentage`: "20%"
 * - `fixed`: "$ 500" (ARS, locale-formatted)
 * - `free_night`: uses i18n key
 *
 * @param discountType - The promotion discount type
 * @param discountValue - The numeric discount magnitude
 * @param locale - Active locale for currency formatting
 * @param freeNightLabel - Already-translated label for `free_night`
 * @returns Human-readable discount string
 */
function formatDiscountSummary({
    discountType,
    discountValue,
    locale,
    freeNightLabel
}: {
    readonly discountType: OwnerPromotionDiscountType;
    readonly discountValue: number;
    readonly locale: SupportedLocale;
    readonly freeNightLabel: string;
}): string {
    if (discountType === 'percentage') {
        return `${discountValue}%`;
    }
    if (discountType === 'free_night') {
        return freeNightLabel;
    }
    // fixed — format as ARS currency
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(discountValue);
}

/**
 * Returns the CSS class suffix for a lifecycle state badge.
 */
function lifecycleBadgeVariant(state: string): 'active' | 'draft' | 'archived' {
    if (state === 'ACTIVE') return 'active';
    if (state === 'ARCHIVED') return 'archived';
    return 'draft';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Owner promotion list island — fetches and displays all promotions for the
 * authenticated owner with per-row inline delete confirmation.
 *
 * @example
 * ```astro
 * <PromotionList client:load locale={locale} />
 * ```
 */
export function PromotionList({ locale }: PromotionListProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<ListState>({ status: 'loading' });
    const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // ── Fetch promotions ──────────────────────────────────────────────────
    // biome-ignore lint/correctness/useExhaustiveDependencies: t is stable per locale; including it causes an infinite loop
    const fetchPromotions = useCallback(async () => {
        setState({ status: 'loading' });
        setDeleteError(null);
        try {
            const [result, entitlementsResult] = await Promise.all([
                ownerPromotionApi.list(),
                billingApi.getEntitlements()
            ]);
            if (!result.ok) {
                setState({
                    status: 'error',
                    message: t(
                        'host.promotions.errors.loadFailed',
                        'No se pudieron cargar las promociones.'
                    )
                });
                return;
            }
            const items = transformOwnerPromotionList({
                items: result.data.items as ReadonlyArray<Record<string, unknown>>
            });
            // Fail-open: if the entitlement read fails, keep the create button
            // enabled — the server still enforces the gate on save, so the worst
            // case is the pre-existing save-time 403, never a wrongly-hidden button.
            const canCreate =
                !entitlementsResult.ok ||
                entitlementsResult.data.entitlements.includes(ENTITLEMENT_CREATE_PROMOTIONS);
            setState({ status: 'ready', items, canCreate });
        } catch {
            setState({
                status: 'error',
                message: t(
                    'host.promotions.errors.loadFailed',
                    'No se pudieron cargar las promociones.'
                )
            });
        }
    }, []);

    useEffect(() => {
        void fetchPromotions();
    }, [fetchPromotions]);

    // ── Delete handlers ───────────────────────────────────────────────────
    const handleDeleteRequest = useCallback((id: string) => {
        setDeleteState({ status: 'confirming', id });
        setDeleteError(null);
    }, []);

    const handleDeleteCancel = useCallback(() => {
        setDeleteState({ status: 'idle' });
    }, []);

    const handleDeleteConfirm = useCallback(
        async (id: string) => {
            setDeleteState({ status: 'pending', id });
            setDeleteError(null);
            try {
                const result = await ownerPromotionApi.remove({ id });
                if (!result.ok) {
                    setDeleteError(
                        t(
                            'host.promotions.errors.deleteFailed',
                            'No se pudo eliminar la promoción.'
                        )
                    );
                    setDeleteState({ status: 'idle' });
                    return;
                }
                setDeleteState({ status: 'idle' });
                void fetchPromotions();
            } catch {
                setDeleteError(
                    t('host.promotions.errors.deleteFailed', 'No se pudo eliminar la promoción.')
                );
                setDeleteState({ status: 'idle' });
            }
        },
        [fetchPromotions, t]
    );

    // ── Render: loading ───────────────────────────────────────────────────
    if (state.status === 'loading') {
        return (
            <div className={styles.container}>
                <div className={styles.skeletonList}>
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={styles.skeletonCard}
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
            <div className={styles.container}>
                <div
                    className={styles.errorBox}
                    role="alert"
                >
                    <p className={styles.errorText}>{state.message}</p>
                    <button
                        type="button"
                        onClick={() => void fetchPromotions()}
                        className={styles.retryButton}
                    >
                        {t('host.dashboard.retry', 'Reintentar')}
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: ready ─────────────────────────────────────────────────────
    const { items, canCreate } = state;
    const freeNightLabel = t('host.promotions.discountTypes.free_night', 'Noche gratis');
    const upgradeUrl = buildUrl({ locale, path: 'suscriptores/planes' });

    return (
        <div className={styles.container}>
            {/* ── Header ── */}
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {t('host.promotions.pageTitle', 'Mis promociones')}
                </h2>
                {canCreate ? (
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta/promociones/nueva' })}
                        className={styles.createButton}
                    >
                        {t('host.promotions.createButton', 'Nueva promoción')}
                    </a>
                ) : null}
            </div>

            {/* ── Upgrade banner (plan without create_promotions) ── */}
            {!canCreate && (
                <div className={styles.upgradeBanner}>
                    <div className={styles.upgradeTextGroup}>
                        <span className={styles.upgradeTitle}>
                            {t(
                                'host.promotions.errors.entitlementRequired',
                                'Tu plan no incluye promociones.'
                            )}
                        </span>
                        <span className={styles.upgradeHint}>
                            {t(
                                'host.promotions.errors.entitlementRequiredHint',
                                'Mejorá tu plan para crear promociones.'
                            )}
                        </span>
                    </div>
                    <a
                        href={upgradeUrl}
                        className={styles.upgradeLink}
                    >
                        {t('host.promotions.actions.upgradePlan', 'Ver planes')}
                    </a>
                </div>
            )}

            {/* ── Delete error banner ── */}
            {deleteError !== null && (
                <div
                    className={styles.deleteErrorBanner}
                    role="alert"
                >
                    {deleteError}
                </div>
            )}

            {/* ── Empty state ── */}
            {items.length === 0 ? (
                // When the plan can't create promotions the upgrade banner above
                // already explains the state, so suppress the "create your first
                // offer" CTA here to avoid a contradictory message.
                canCreate ? (
                    <p className={styles.emptyText}>
                        {t(
                            'host.promotions.empty',
                            'Todavía no tenés ninguna promoción. ¡Creá tu primera oferta!'
                        )}
                    </p>
                ) : null
            ) : (
                <ul className={styles.list}>
                    {items.map((promo) => {
                        const isConfirming =
                            deleteState.status === 'confirming' && deleteState.id === promo.id;
                        const isPending =
                            deleteState.status === 'pending' && deleteState.id === promo.id;
                        const badgeVariant = lifecycleBadgeVariant(promo.lifecycleState);
                        const lifecycleLabel = t(
                            `host.promotions.lifecycleStates.${promo.lifecycleState.toLowerCase()}`,
                            promo.lifecycleState
                        );
                        const discountSummary = formatDiscountSummary({
                            discountType: promo.discountType,
                            discountValue: promo.discountValue,
                            locale,
                            freeNightLabel
                        });
                        const validityText = promo.validUntil
                            ? `${formatDate({ date: promo.validFrom, locale })} → ${formatDate({ date: promo.validUntil, locale })}`
                            : `${formatDate({ date: promo.validFrom, locale })} → ${t('host.promotions.fields.noExpiry', 'Sin vencimiento')}`;

                        return (
                            <li
                                key={promo.id}
                                className={styles.card}
                            >
                                {/* ── Card header ── */}
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>{promo.title}</h3>
                                    <span
                                        className={`${styles.badge} ${styles[`badge--${badgeVariant}`]}`}
                                        aria-label={lifecycleLabel}
                                    >
                                        {lifecycleLabel}
                                    </span>
                                </div>

                                {/* ── Discount + validity ── */}
                                <div className={styles.cardMeta}>
                                    <span className={styles.discount}>{discountSummary}</span>
                                    <span className={styles.validity}>{validityText}</span>
                                </div>

                                {/* ── Inline confirm or action buttons ── */}
                                {isConfirming ? (
                                    <div className={styles.confirmRow}>
                                        <span
                                            className={styles.confirmText}
                                            role="alert"
                                        >
                                            {t(
                                                'host.promotions.actions.confirmDelete',
                                                '¿Eliminar esta promoción? Esta acción no se puede deshacer.'
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => void handleDeleteConfirm(promo.id)}
                                            className={styles.confirmYesButton}
                                            disabled={isPending}
                                        >
                                            {t('host.promotions.actions.delete', 'Eliminar')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteCancel}
                                            className={styles.confirmNoButton}
                                        >
                                            {t('host.promotions.actions.cancel', 'Cancelar')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.actions}>
                                        <a
                                            href={buildUrl({
                                                locale,
                                                path: `mi-cuenta/promociones/${promo.id}/editar`
                                            })}
                                            className={styles.editLink}
                                        >
                                            {t('host.promotions.actions.edit', 'Editar')}
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRequest(promo.id)}
                                            className={styles.deleteButton}
                                            disabled={isPending}
                                        >
                                            {t('host.promotions.actions.delete', 'Eliminar')}
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

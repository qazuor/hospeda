/**
 * @file AlertsList.client.tsx
 * @description React island for the price-alert management page (SPEC-286 T-010).
 *
 * Renders the authenticated user's active price-alert subscriptions with:
 *  - Accommodation name, subscription-time price, and target-drop threshold
 *  - Delete-one action (inline confirmation, optimistic removal on success)
 *  - Empty state (CTA to browse accommodations)
 *  - Plan-gate ("upgrade") state when the API reports the actor lacks the
 *    `PRICE_ALERTS` entitlement
 *
 * All API calls go to `/api/v1/protected/price-alerts/*`, mirroring the fetch
 * pattern used by `SearchHistoryList.client.tsx` (SPEC-289): plain `fetch`
 * with `credentials: 'include'` so the browser's own session cookie
 * authenticates the request — no `apiClient` wrapper needed for a
 * same-origin protected island.
 *
 * KNOWN API LIMITATIONS (see inline comments below for detail):
 *  - `GET /api/v1/protected/price-alerts` is NOT entitlement-gated today (its
 *    route doc explicitly says "Ungated"), so the upgrade-CTA branch below is
 *    defensive/forward-compatible rather than reachable with the current API.
 *    A free-plan user with zero alerts is today indistinguishable from a
 *    Plus/VIP user with zero alerts — both just see the empty state.
 *  - The response has no `accommodationSlug` or current-price field, only the
 *    subscription-time snapshot (`basePriceSnapshot`). The accommodation name
 *    is rendered as plain text (not a link) until a follow-up adds the slug.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { BellIcon } from '@repo/icons';
import type { PriceAlertResponse } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountEmptyState } from '@/components/account/AccountEmptyState';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import styles from './AlertsList.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Successful list response envelope (`GET /api/v1/protected/price-alerts`). */
interface ListSuccessResponse {
    readonly success: true;
    readonly data?: {
        readonly items?: PriceAlertResponse[];
    };
}

/** Error response envelope shared by all protected endpoints. */
interface ErrorResponse {
    readonly success: false;
    readonly error?: {
        readonly code?: string | null;
        readonly message?: string | null;
    };
}

/** View state of the alerts list island. */
type ListStatus =
    | { readonly kind: 'loading' }
    | { readonly kind: 'ready' }
    | { readonly kind: 'upgrade' }
    | { readonly kind: 'error'; readonly message: string };

/** Props for the AlertsList island. */
export interface AlertsListProps {
    /** Active locale for i18n and URL building. */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /**
     * Authenticated user ID.
     * NOTE: not used for API calls — the session cookie is authoritative for
     * all protected endpoints. Reserved for future display purposes (mirrors
     * `SearchHistoryListProps.userId`).
     */
    readonly userId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Price-alert list island.
 *
 * Lists the authenticated user's active price-alert subscriptions and
 * provides a per-item delete action with inline confirmation.
 */
export function AlertsList({ locale, apiUrl, userId: _userId }: AlertsListProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    // ── State ─────────────────────────────────────────────────────────────────
    const [status, setStatus] = useState<ListStatus>({ kind: 'loading' });
    const [alerts, setAlerts] = useState<PriceAlertResponse[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Pre-compute translated strings used in callbacks to avoid stale deps on
    // the `t` function (same pattern as SearchHistoryList).
    const fetchErrorMsg = t(
        'account.alerts.errorFetch',
        'No se pudieron cargar tus alertas de precio'
    );
    const deleteErrorMsg = t('account.alerts.deleteError', 'No se pudo eliminar la alerta');
    const deleteSuccessMsg = t('account.alerts.deleteSuccess', 'Alerta eliminada');

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchAlerts = useCallback(async () => {
        if (!isMountedRef.current) return;
        setStatus({ kind: 'loading' });
        try {
            const res = await fetch(`${base}/api/v1/protected/price-alerts`, {
                credentials: 'include'
            });

            if (!res.ok) {
                // Plan-gate detection: the API signals "feature not included in
                // your plan" as a 403 with error.code === 'ENTITLEMENT_REQUIRED'
                // (see apps/api/src/middlewares/tourist-entitlements.ts#gateAlerts).
                // NOTE: as of SPEC-286 T-010, `GET /price-alerts` itself is NOT
                // gated (only POST is) — this branch is defensive/forward-looking
                // and will not currently trigger. Kept because it's the correct
                // way to detect the gate per the project's error-envelope
                // convention, and costs nothing to leave in place.
                let code: string | null | undefined;
                try {
                    const errorBody = (await res.json()) as ErrorResponse;
                    code = errorBody.error?.code;
                } catch {
                    // Non-JSON error body — fall through to the generic error state.
                }

                if (res.status === 403 && code === 'ENTITLEMENT_REQUIRED') {
                    if (isMountedRef.current) {
                        setStatus({ kind: 'upgrade' });
                    }
                    return;
                }

                throw new Error(fetchErrorMsg);
            }

            const body = (await res.json()) as ListSuccessResponse;
            if (!isMountedRef.current) return;
            setAlerts(body.data?.items ?? []);
            setStatus({ kind: 'ready' });
        } catch (err) {
            webLogger.error('[AlertsList] failed to fetch price alerts', err);
            if (isMountedRef.current) {
                setStatus({
                    kind: 'error',
                    message: err instanceof Error ? err.message : fetchErrorMsg
                });
            }
        }
    }, [base, fetchErrorMsg]);

    useEffect(() => {
        void fetchAlerts();
    }, [fetchAlerts]);

    // ── Delete one ────────────────────────────────────────────────────────────

    /**
     * Cancel (soft-delete) a single price-alert subscription. Shows inline
     * confirmation before calling the API. Optimistically removes the item
     * from local state on success — the endpoint returns a true 204 No
     * Content, so no response body is parsed on the happy path.
     */
    const handleDeleteConfirm = useCallback(
        async (id: string) => {
            setDeletingId(id);
            setConfirmDeleteId(null);
            try {
                const res = await fetch(`${base}/api/v1/protected/price-alerts/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!res.ok) {
                    // Only attempt to parse a body on failure — success is 204.
                    let message = deleteErrorMsg;
                    try {
                        const body = (await res.json()) as ErrorResponse;
                        message = body.error?.message ?? deleteErrorMsg;
                    } catch {
                        // Non-JSON error body — keep the generic message.
                    }
                    throw new Error(message);
                }

                if (isMountedRef.current) {
                    setAlerts((prev) => prev.filter((a) => a.id !== id));
                    addToast({ type: 'success', message: deleteSuccessMsg });
                }
            } catch (err) {
                addToast({
                    type: 'error',
                    message: err instanceof Error ? err.message : deleteErrorMsg
                });
            } finally {
                if (isMountedRef.current) {
                    setDeletingId(null);
                }
            }
        },
        [base, deleteErrorMsg, deleteSuccessMsg]
    );

    // ── Render helpers ────────────────────────────────────────────────────────

    /**
     * Format the target-drop threshold for display.
     * `null` means "notify on any drop" (see `PriceAlertSchema.targetPercentDrop`).
     */
    function formatTargetDrop(targetPercentDrop: number | null): string {
        if (targetPercentDrop === null) {
            return t('account.alerts.item.targetAny', 'Cualquier baja');
        }
        return t('account.alerts.item.targetPercent', '{{percent}}% o más', {
            percent: targetPercentDrop
        });
    }

    const listingHref = buildUrl({ locale, path: 'alojamientos' });
    // Tourist-only Área Turista feature — the CTA must point at the tourist
    // pricing page, not the owner one (BETA-174).
    const upgradeHref = buildUrl({ locale, path: 'suscriptores/turistas' });

    // ── Loading state ─────────────────────────────────────────────────────────

    if (status.kind === 'loading') {
        return (
            <div
                className={styles.alerts}
                aria-busy="true"
            >
                <p
                    className={styles.alertsLoading}
                    aria-live="polite"
                >
                    {t('account.alerts.loading', 'Cargando alertas...')}
                </p>
            </div>
        );
    }

    // ── Upgrade (plan-gate) state ────────────────────────────────────────────

    if (status.kind === 'upgrade') {
        return (
            <div
                className={styles.alertsUpgrade}
                aria-live="polite"
            >
                <p className={styles.alertsUpgradeTitle}>
                    {t('account.alerts.upgrade.title', 'Alertas de precio')}
                </p>
                <p className={styles.alertsUpgradeMessage}>
                    {t(
                        'account.alerts.upgrade.message',
                        'Las alertas de precio están disponibles en los planes Plus y VIP. Actualizá tu plan para acceder.'
                    )}
                </p>
                <a
                    href={upgradeHref}
                    className={styles.alertsUpgradeCta}
                >
                    {t('account.alerts.upgrade.cta', 'Ver planes')}
                </a>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────────────────

    if (status.kind === 'error') {
        return (
            <div className={styles.alerts}>
                <p
                    className={styles.alertsError}
                    role="alert"
                >
                    {status.message}
                </p>
                <button
                    type="button"
                    className={styles.alertsRetryBtn}
                    onClick={() => void fetchAlerts()}
                >
                    {t('common.retry', 'Reintentar')}
                </button>
            </div>
        );
    }

    // ── Empty state ───────────────────────────────────────────────────────────

    const isEmpty = alerts.length === 0;

    if (isEmpty) {
        return (
            <AccountEmptyState
                title={t('account.alerts.empty.title', 'No tenés alertas activas')}
                description={t(
                    'account.alerts.empty.body',
                    'Explorá alojamientos y activá alertas para enterarte cuando bajen de precio.'
                )}
                icon={<BellIcon size={28} />}
                ctaLabel={t('account.alerts.empty.cta', 'Explorar alojamientos')}
                ctaHref={listingHref}
            />
        );
    }

    // ── Ready state (list) ────────────────────────────────────────────────────

    return (
        <ul
            className={styles.alertsList}
            aria-label={t('account.alerts.listLabel', 'Tus alertas de precio activas')}
        >
            {alerts.map((alert) => {
                const isDeleting = deletingId === alert.id;
                const confirmingThis = confirmDeleteId === alert.id;

                return (
                    <li
                        key={alert.id}
                        className={[styles.alertsItem, isDeleting ? styles.alertsItemDeleting : '']
                            .filter(Boolean)
                            .join(' ')}
                        aria-busy={isDeleting}
                    >
                        <div className={styles.alertsItemContent}>
                            {/*
                             * The API response has no `accommodationSlug`, only
                             * `accommodationName` — rendered as plain text rather
                             * than a link. A follow-up that adds the slug to
                             * `PriceAlertResponseSchema` can turn this into an
                             * `<a href={buildUrl({ locale, path: `alojamientos/${slug}` })}>`.
                             */}
                            <p className={styles.alertsItemName}>{alert.accommodationName}</p>

                            <div className={styles.alertsItemMeta}>
                                <span className={styles.alertsItemPrice}>
                                    {t('account.alerts.item.priceLabel', 'Precio al suscribirte')}:{' '}
                                    {formatPrice({ amount: alert.basePriceSnapshot / 100, locale })}
                                </span>
                                <span className={styles.alertsItemTarget}>
                                    {t('account.alerts.item.targetLabel', 'Alertar cuando baje')}:{' '}
                                    {formatTargetDrop(alert.targetPercentDrop)}
                                </span>
                            </div>
                        </div>

                        <div className={styles.alertsItemActions}>
                            {confirmingThis ? (
                                // biome-ignore lint/a11y/useSemanticElements: div+role=group+aria-label groups the inline confirmation prompt with its action buttons; no native element fits (fieldset implies form fields, not an action confirmation)
                                <div
                                    className={styles.alertsDeleteConfirm}
                                    role="group"
                                    aria-label={`${t('account.alerts.deleteConfirmAria', 'Confirmar eliminación de alerta')}: ${alert.accommodationName}`}
                                >
                                    <button
                                        type="button"
                                        className={styles.alertsConfirmYes}
                                        onClick={() => void handleDeleteConfirm(alert.id)}
                                    >
                                        {t('account.alerts.deleteOneConfirm', 'Sí, eliminar')}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.alertsConfirmNo}
                                        onClick={() => setConfirmDeleteId(null)}
                                    >
                                        {t('account.alerts.deleteCancel', 'Cancelar')}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className={styles.alertsDeleteBtn}
                                    onClick={() => setConfirmDeleteId(alert.id)}
                                    disabled={isDeleting || deletingId !== null}
                                    aria-label={`${t('account.alerts.deleteOne', 'Eliminar')}: ${alert.accommodationName}`}
                                >
                                    {t('account.alerts.deleteOne', 'Eliminar')}
                                </button>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

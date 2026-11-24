/**
 * @file AlertsList.client.tsx
 * @description React island for the price-alert management page (SPEC-286 T-010).
 *
 * Renders the authenticated user's price-alert subscriptions with:
 *  - Accommodation name, subscription-time price, and target-drop threshold
 *  - Delete-one action (kit ConfirmDialog, optimistic removal on success)
 *  - Empty state (CTA to browse accommodations)
 *  - Plan-gate state (kit LockedState, plan names from the catalog) when the
 *    API reports the actor lacks the `PRICE_ALERTS` entitlement
 *  - Closed alerts (HOS-1492, V8a row 27): an alert whose listing reached
 *    `PURGED` (`closedBecauseListingGone`) is listed apart, as CLOSED, saying
 *    only that the listing no longer exists — never why (that belongs to the
 *    owner, row 20) — and without the active alert's threshold copy
 *
 * All API calls go to `/api/v1/protected/price-alerts/*`, mirroring the fetch
 * pattern used by `SearchHistoryList.client.tsx` (SPEC-289): plain `fetch`
 * with `credentials: 'include'` so the browser's own session cookie
 * authenticates the request — no `apiClient` wrapper needed for a
 * same-origin protected island.
 *
 * KNOWN API LIMITATIONS (see inline comments below for detail):
 *  - `GET /api/v1/protected/price-alerts` is NOT entitlement-gated (its route
 *    doc says "Ungated"). HOS-2599: the island reads the tourist effective set
 *    beside it, so a Free tourist with zero alerts gets the LockedState instead
 *    of an empty state that invites a feature the plan refuses
 *    (`showPriceAlertsLock`). The 403 branch stays for a future gated list.
 *  - The response has no `accommodationSlug` or current-price field, only the
 *    subscription-time snapshot (`basePriceSnapshot`). The accommodation name
 *    is rendered as plain text (not a link) until a follow-up adds the slug.
 *
 * HOS-2501: kit Sections, DataList rows, Skeleton, ErrorState, EmptyState,
 * LockedState and ConfirmDialog (no inline confirmation of its own).
 *
 * Hydration: caller MUST use `client:load`.
 */

import { BellIcon } from '@repo/icons';
import type { PriceAlertListItem } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { visibleApiMessage } from '@/lib/api-errors';
import { getEntitlementsCached } from '@/lib/entitlements-cache';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { showPriceAlertsLock } from '@/lib/price-alert-gate';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import styles from './AlertsList.module.css';
import {
    Button,
    DataList,
    EmptyState,
    ErrorState,
    LinkButton,
    ListRow,
    LockedState,
    Section,
    Skeleton,
    StatusPill,
    useConfirm
} from './ui';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Successful list response envelope (`GET /api/v1/protected/price-alerts`). */
interface ListSuccessResponse {
    readonly success: true;
    readonly data?: {
        readonly items?: PriceAlertListItem[];
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
    /**
     * HOS-2437: names of the catalog plans that carry the price-alerts entitlement, read by
     * the SSR page (the catalog reader is server-only). Empty when the catalog could not be
     * read: the plan gate then names no plan.
     */
    readonly gatePlanNames?: readonly string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Price-alert list island.
 *
 * Lists the authenticated user's active price-alert subscriptions and
 * provides a per-item delete action with inline confirmation.
 */
export function AlertsList({
    locale,
    apiUrl,
    userId: _userId,
    gatePlanNames = []
}: AlertsListProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    // ── State ─────────────────────────────────────────────────────────────────
    const [status, setStatus] = useState<ListStatus>({ kind: 'loading' });
    const [alerts, setAlerts] = useState<PriceAlertListItem[]>([]);
    const { confirm: askConfirmation, confirmDialog } = useConfirm({ locale });

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
            // HOS-2599: the list is not gated, so the tourist effective set is read beside it
            // to tell an empty list from a plan that does not include alerts.
            const [res, effectiveSet] = await Promise.all([
                fetch(`${base}/api/v1/protected/price-alerts`, { credentials: 'include' }),
                getEntitlementsCached({ vertical: 'tourist' })
            ]);

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
            const items = body.data?.items ?? [];
            if (showPriceAlertsLock({ alertCount: items.length, effectiveSet })) {
                setStatus({ kind: 'upgrade' });
                return;
            }
            setAlerts(items);
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
     * Cancel (soft-delete) a single price-alert subscription. Asks first with
     * the kit ConfirmDialog; the dialog runs the request itself and stays open
     * with a retry if it fails. Removes the item from local state on success:
     * the endpoint returns a true 204 No Content, so no body is parsed on the
     * happy path.
     */
    const requestDelete = useCallback(
        async (alert: PriceAlertListItem) => {
            await askConfirmation({
                title: t('account.alerts.deleteConfirmTitle'),
                description: t('account.alerts.deleteConfirmBody', undefined, {
                    name: alert.accommodationName
                }),
                confirmLabel: t('account.alerts.deleteOneConfirm'),
                cancelLabel: t('account.alerts.deleteCancel'),
                onConfirm: async () => {
                    const res = await fetch(`${base}/api/v1/protected/price-alerts/${alert.id}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });

                    if (!res.ok) {
                        // Only attempt to parse a body on failure: success is 204.
                        let message = deleteErrorMsg;
                        try {
                            const body = (await res.json()) as ErrorResponse;
                            message =
                                visibleApiMessage({ error: body.error, status: res.status }) ??
                                deleteErrorMsg;
                        } catch {
                            // Non-JSON error body: keep the generic message.
                        }
                        // A rejection keeps the dialog open so the user can retry.
                        throw new Error(message);
                    }

                    if (isMountedRef.current) {
                        setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                        addToast({ type: 'success', message: deleteSuccessMsg });
                    }
                }
            });
        },
        [base, askConfirmation, t, deleteErrorMsg, deleteSuccessMsg]
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
    // Tourist-only Área Turista feature: the CTA must point at the tourist
    // pricing page, not the owner one (BETA-174).
    const upgradeHref = buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.tourist });

    // ── Loading state ─────────────────────────────────────────────────────────

    if (status.kind === 'loading') {
        return (
            <Section
                title={t('account.alerts.activeHeading')}
                helpId="section:account.alerts-active"
            >
                <Skeleton.Row locale={locale} />
                <Skeleton.Row locale={locale} />
            </Section>
        );
    }

    // ── Plan-gate state ──────────────────────────────────────────────────────
    // The plan names come from the catalog (read by the SSR page), never a literal.

    if (status.kind === 'upgrade') {
        return (
            <LockedState
                locale={locale}
                reason={{
                    kind: 'plan',
                    feature: t('account.alerts.upgrade.title'),
                    description: t('account.alerts.lock.description'),
                    plans: gatePlanNames.map((name) => ({ name })),
                    plansHref: upgradeHref
                }}
            />
        );
    }

    // ── Error state ───────────────────────────────────────────────────────────

    if (status.kind === 'error') {
        return (
            <ErrorState
                locale={locale}
                description={status.message}
                onRetry={() => fetchAlerts()}
            />
        );
    }

    // ── Empty state ───────────────────────────────────────────────────────────

    if (alerts.length === 0) {
        return (
            <EmptyState
                title={t('account.alerts.empty.title', 'No tenés alertas activas')}
                description={t(
                    'account.alerts.empty.body',
                    'Explorá alojamientos y activá alertas para enterarte cuando bajen de precio.'
                )}
                icon={<BellIcon size={28} />}
                action={<LinkButton href={listingHref}>{t('account.alerts.empty.cta')}</LinkButton>}
            />
        );
    }

    // ── Ready state (lists) ───────────────────────────────────────────────────

    /**
     * One alert row. A closed alert (row 27) shows its name and the closed
     * notice only: no subscription price and no "alert when it drops" line,
     * because it no longer alerts. Both keep the delete action.
     */
    function renderItem(alert: PriceAlertListItem) {
        const closed = alert.closedBecauseListingGone;
        return (
            <ListRow
                key={alert.id}
                rowId={alert.id}
                title={alert.accommodationName}
                // The API response has no `accommodationSlug`, only the name: plain text
                // until a follow-up adds the slug to `PriceAlertResponseSchema`.
                meta={
                    closed
                        ? undefined
                        : `${t('account.alerts.item.priceLabel')}: ${formatPrice({
                              amount: alert.basePriceSnapshot / 100,
                              locale
                          })}`
                }
                description={
                    closed
                        ? t('account.alerts.closedNotice')
                        : `${t('account.alerts.item.targetLabel')}: ${formatTargetDrop(alert.targetPercentDrop)}`
                }
                trailing={
                    closed ? (
                        <StatusPill tone="neutral">{t('account.alerts.closedStatus')}</StatusPill>
                    ) : undefined
                }
                actions={[
                    <Button
                        key="delete"
                        variant="danger-ghost"
                        size="sm"
                        onClick={() => void requestDelete(alert)}
                        aria-label={`${t('account.alerts.deleteOne')}: ${alert.accommodationName}`}
                    >
                        {t('account.alerts.deleteOne')}
                    </Button>
                ]}
                className={styles.row}
            />
        );
    }

    const activeAlerts = alerts.filter((alert) => !alert.closedBecauseListingGone);
    const closedAlerts = alerts.filter((alert) => alert.closedBecauseListingGone);

    // Each list is its own flat Section; a list that holds a closed alert is never
    // called "active".
    return (
        <div className={styles.groups}>
            {activeAlerts.length > 0 && (
                <Section
                    title={t('account.alerts.activeHeading')}
                    helpId="section:account.alerts-active"
                >
                    <DataList label={t('account.alerts.listLabel')}>
                        {activeAlerts.map(renderItem)}
                    </DataList>
                </Section>
            )}
            {closedAlerts.length > 0 && (
                <Section
                    title={t('account.alerts.closedHeading')}
                    helpId="section:account.alerts-closed"
                >
                    <DataList label={t('account.alerts.closedListLabel')}>
                        {closedAlerts.map(renderItem)}
                    </DataList>
                </Section>
            )}
            {confirmDialog}
        </div>
    );
}

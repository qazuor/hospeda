/**
 * @file ExclusiveDealsList.client.tsx
 * @description React island for the exclusive-deals listing page (HOS-21 T-012).
 *
 * Renders the authenticated tourist's plan-scoped owner promotions with:
 *  - Loading / error / empty / populated states
 *  - Plan-gate ("upgrade") state when the API reports the actor lacks the
 *    `EXCLUSIVE_DEALS` entitlement (403 ENTITLEMENT_REQUIRED)
 *  - A VIP-only badge on deals scoped to `touristAudience === 'vip'`
 *
 * All API calls go to `/api/v1/protected/owner-promotions/exclusive-deals`,
 * mirroring the fetch pattern used by `AlertsList.client.tsx`: plain `fetch`
 * with `credentials: 'include'` so the browser's own session cookie
 * authenticates the request — no `apiClient` wrapper needed for a
 * same-origin protected island.
 *
 * Discount label formatting mirrors `PromotionBanner.astro`'s `formatDiscount`
 * (percentage/fixed/free_night) — kept in sync manually since one is an Astro
 * frontmatter function and the other a React island, with no shared util yet.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { OffersIcon } from '@repo/icons';
import type { OwnerPromotionListItem } from '@repo/schemas';
import { TouristAudienceEnum } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountEmptyState } from '@/components/account/AccountEmptyState';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { buildUrl } from '@/lib/urls';
import styles from './ExclusiveDealsList.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Successful list response envelope (`GET .../exclusive-deals`). */
interface ListSuccessResponse {
    readonly success: true;
    readonly data?: {
        readonly items?: OwnerPromotionListItem[];
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

/** View state of the exclusive-deals list island. */
type ListStatus =
    | { readonly kind: 'loading' }
    | { readonly kind: 'ready' }
    | { readonly kind: 'upgrade' }
    | { readonly kind: 'error'; readonly message: string };

/** Props for the ExclusiveDealsList island. */
export interface ExclusiveDealsListProps {
    /** Active locale for i18n and URL building. */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /**
     * Authenticated user ID.
     * NOTE: not used for API calls — the session cookie is authoritative for
     * all protected endpoints. Reserved for future display purposes (mirrors
     * `AlertsListProps.userId`).
     */
    readonly userId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Exclusive-deals list island.
 *
 * Lists the authenticated tourist's plan-scoped active owner promotions
 * (plus-tier deals, additive vip-only deals for tourist-vip).
 */
export function ExclusiveDealsList({ locale, apiUrl, userId: _userId }: ExclusiveDealsListProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    // ── State ─────────────────────────────────────────────────────────────────
    const [status, setStatus] = useState<ListStatus>({ kind: 'loading' });
    const [deals, setDeals] = useState<OwnerPromotionListItem[]>([]);

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchErrorMsg = t(
        'account.exclusiveDeals.errorFetch',
        'No se pudieron cargar tus ofertas exclusivas'
    );

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchDeals = useCallback(async () => {
        if (!isMountedRef.current) return;
        setStatus({ kind: 'loading' });
        try {
            const res = await fetch(`${base}/api/v1/protected/owner-promotions/exclusive-deals`, {
                credentials: 'include'
            });

            if (!res.ok) {
                // Plan-gate detection: the API signals "feature not included in
                // your plan" as a 403 with error.code === 'ENTITLEMENT_REQUIRED'
                // (see apps/api/src/middlewares/tourist-entitlements.ts#gateExclusiveDeals).
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
            setDeals(body.data?.items ?? []);
            setStatus({ kind: 'ready' });
        } catch (err) {
            webLogger.error('[ExclusiveDealsList] failed to fetch exclusive deals', err);
            if (isMountedRef.current) {
                setStatus({
                    kind: 'error',
                    message: err instanceof Error ? err.message : fetchErrorMsg
                });
            }
        }
    }, [base, fetchErrorMsg]);

    useEffect(() => {
        void fetchDeals();
    }, [fetchDeals]);

    // ── Render helpers ────────────────────────────────────────────────────────

    /**
     * Locale-aware discount label for a given deal — mirrors
     * `PromotionBanner.astro`'s `formatDiscount`.
     */
    function formatDiscount(deal: OwnerPromotionListItem): string {
        const { discountType, discountValue } = deal;
        const off = t('accommodations.detail.promotions.discountOff', 'de descuento');

        if (discountType === 'percentage') {
            return `${discountValue}% ${off}`;
        }
        if (discountType === 'fixed') {
            const formatted = formatPrice({ amount: discountValue, locale });
            return `${formatted} ${off}`;
        }
        if (discountType === 'free_night') {
            return t('host.promotions.discountTypes.free_night', 'Noche gratis');
        }
        return String(discountValue);
    }

    // Tourist-only Área Turista feature — the CTA must point at the tourist
    // pricing page, not the owner one (BETA-174).
    const upgradeHref = buildUrl({ locale, path: 'suscriptores/turistas' });

    // ── Loading state ─────────────────────────────────────────────────────────

    if (status.kind === 'loading') {
        return (
            <div
                className={styles.deals}
                aria-busy="true"
            >
                <p
                    className={styles.dealsLoading}
                    aria-live="polite"
                >
                    {t('account.exclusiveDeals.loading', 'Cargando ofertas exclusivas...')}
                </p>
            </div>
        );
    }

    // ── Upgrade (plan-gate) state ────────────────────────────────────────────

    if (status.kind === 'upgrade') {
        return (
            <div
                className={styles.dealsUpgrade}
                aria-live="polite"
            >
                <p className={styles.dealsUpgradeTitle}>
                    {t('account.exclusiveDeals.upgrade.title', 'Ofertas exclusivas')}
                </p>
                <p className={styles.dealsUpgradeMessage}>
                    {t(
                        'account.exclusiveDeals.upgrade.message',
                        'Las ofertas exclusivas están disponibles en los planes Plus y VIP. Actualizá tu plan para acceder.'
                    )}
                </p>
                <a
                    href={upgradeHref}
                    className={styles.dealsUpgradeCta}
                >
                    {t('account.exclusiveDeals.upgrade.cta', 'Ver planes')}
                </a>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────────────────

    if (status.kind === 'error') {
        return (
            <div className={styles.deals}>
                <p
                    className={styles.dealsError}
                    role="alert"
                >
                    {status.message}
                </p>
                <button
                    type="button"
                    className={styles.dealsRetryBtn}
                    onClick={() => void fetchDeals()}
                >
                    {t('common.retry', 'Reintentar')}
                </button>
            </div>
        );
    }

    // ── Empty state ───────────────────────────────────────────────────────────

    const isEmpty = deals.length === 0;

    if (isEmpty) {
        return (
            <AccountEmptyState
                title={t('account.exclusiveDeals.empty.title', 'No hay ofertas activas por ahora')}
                description={t(
                    'account.exclusiveDeals.empty.body',
                    'Volvé más tarde para ver nuevas ofertas exclusivas para tu plan.'
                )}
                icon={<OffersIcon size={28} />}
            />
        );
    }

    // ── Ready state (list) ────────────────────────────────────────────────────

    return (
        <ul
            className={styles.dealsList}
            aria-label={t('account.exclusiveDeals.listLabel', 'Tus ofertas exclusivas')}
        >
            {deals.map((deal) => (
                <li
                    key={deal.id}
                    className={styles.dealsItem}
                >
                    <div className={styles.dealsItemContent}>
                        <div className={styles.dealsItemHeader}>
                            <p className={styles.dealsItemName}>{deal.title}</p>
                            {deal.touristAudience === TouristAudienceEnum.VIP && (
                                <span className={styles.dealsVipBadge}>
                                    {t('account.exclusiveDeals.item.vipBadge', 'Solo VIP')}
                                </span>
                            )}
                        </div>
                        <p className={styles.dealsItemDiscount}>{formatDiscount(deal)}</p>
                    </div>
                </li>
            ))}
        </ul>
    );
}

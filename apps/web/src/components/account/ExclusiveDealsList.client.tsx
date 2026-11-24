/**
 * @file ExclusiveDealsList.client.tsx
 * @description React island for the exclusive-deals listing page (HOS-21 T-012).
 *
 * Renders the authenticated tourist's plan-scoped owner promotions on the
 * account kit (HOS-2507, D21) with:
 *  - `Skeleton` while loading, `ErrorState` with retry, `EmptyState`, and a
 *    `DataList` of `ListRow`s when populated
 *  - Plan-gate state (`LockedState`) when the API reports the actor lacks the
 *    `EXCLUSIVE_DEALS` entitlement (403 ENTITLEMENT_REQUIRED)
 *  - A VIP-only pill on deals scoped to `touristAudience === 'vip'`
 *  - Rows that are no longer inert: the validity date, and a «Ver alojamiento»
 *    link for a deal tied to one accommodation. Owner decision 17 (Mi cuenta
 *    UI epic): the API now carries `accommodationSlug`, so the action is a
 *    real `<a href>` (open in a new tab, copy the link) instead of a per-click
 *    slug lookup. A deal whose accommodation is no longer public comes with a
 *    `null` slug: the row says so inline and offers no link. Owner-wide deals
 *    (no accommodation) point nowhere and stay informational.
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
import type { ExclusiveDealListItem } from '@repo/schemas';
import { TouristAudienceEnum } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    AsyncRegion,
    type AsyncResult,
    DataList,
    EmptyState,
    ErrorState,
    LinkButton,
    ListRow,
    LockedState,
    Skeleton,
    StatusPill
} from '@/components/account/ui';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { formatPromotionBenefit } from '@/lib/promotions/format-benefit';
import { buildUrl } from '@/lib/urls';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Successful list response envelope (`GET .../exclusive-deals`). */
interface ListSuccessResponse {
    readonly success: true;
    readonly data?: {
        readonly items?: ExclusiveDealListItem[];
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
    /**
     * HOS-2554: catalog names of the plans that carry exclusive deals, read by the SSR page
     * (the catalog reader is server-only). Empty when the catalog could not be read.
     */
    readonly gatePlanNames?: readonly string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Exclusive-deals list island.
 *
 * Lists the authenticated tourist's plan-scoped active owner promotions
 * (plus-tier deals, additive vip-only deals for tourist-vip).
 */
export function ExclusiveDealsList({
    locale,
    apiUrl,
    userId: _userId,
    gatePlanNames = []
}: ExclusiveDealsListProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    // ── State ─────────────────────────────────────────────────────────────────
    const [status, setStatus] = useState<ListStatus>({ kind: 'loading' });
    const [deals, setDeals] = useState<ExclusiveDealListItem[]>([]);

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

    // ── Render ────────────────────────────────────────────────────────────────

    // Tourist-only Área Turista feature — the CTA must point at the tourist
    // pricing page, not the owner one (BETA-174).
    const upgradeHref = buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.tourist });

    const state: AsyncResult<readonly ExclusiveDealListItem[]> =
        status.kind === 'loading'
            ? { status: 'loading' }
            : status.kind === 'upgrade'
              ? {
                    status: 'locked',
                    reason: {
                        kind: 'plan',
                        feature: t('account.exclusiveDeals.upgrade.title', 'Ofertas exclusivas'),
                        // HOS-2599: the plans are named by the LockedState pills (catalog names,
                        // like Alertas de precio), so «Está incluida en:» is never left empty.
                        // Without catalog names the description says the plan lacks it.
                        description:
                            gatePlanNames.length > 0
                                ? t('account.exclusiveDeals.lock.description')
                                : t('account.exclusiveDeals.upgrade.messageNoPlans'),
                        plans: gatePlanNames.map((name) => ({ name })),
                        plansHref: upgradeHref
                    }
                }
              : status.kind === 'error'
                ? { status: 'error', retry: () => void fetchDeals() }
                : deals.length === 0
                  ? { status: 'empty' }
                  : { status: 'ready', data: deals };

    return (
        <AsyncRegion
            state={state}
            loading={() => (
                <Skeleton
                    locale={locale}
                    lines={4}
                />
            )}
            error={({ retry }) => (
                <ErrorState
                    locale={locale}
                    onRetry={retry}
                    description={status.kind === 'error' ? status.message : fetchErrorMsg}
                />
            )}
            empty={() => (
                <EmptyState
                    title={t(
                        'account.exclusiveDeals.empty.title',
                        'No hay ofertas activas por ahora'
                    )}
                    description={t(
                        'account.exclusiveDeals.empty.body',
                        'Volvé más tarde para ver nuevas ofertas exclusivas para tu plan.'
                    )}
                    icon={<OffersIcon size="lg" />}
                />
            )}
            locked={(reason) => (
                <LockedState
                    reason={reason}
                    locale={locale}
                />
            )}
            ready={(items) => (
                <DataList label={t('account.exclusiveDeals.listLabel', 'Tus ofertas exclusivas')}>
                    {items.map((deal) => {
                        // A deal tied to an accommodation that is no longer public.
                        const unavailable =
                            Boolean(deal.accommodationId) && deal.accommodationSlug === null;
                        return (
                            <ListRow
                                key={deal.id}
                                rowId={deal.id}
                                title={deal.title}
                                meta={
                                    deal.validUntil
                                        ? t('account.exclusiveDeals.item.validUntil', undefined, {
                                              date: formatDate({ date: deal.validUntil, locale })
                                          })
                                        : undefined
                                }
                                description={formatPromotionBenefit({
                                    discountType: deal.discountType,
                                    discountValue: deal.discountValue,
                                    locale
                                })}
                                trailing={
                                    deal.touristAudience === TouristAudienceEnum.VIP ? (
                                        <StatusPill tone="plan">
                                            {t('account.exclusiveDeals.item.vipBadge', 'Solo VIP')}
                                        </StatusPill>
                                    ) : undefined
                                }
                                extra={
                                    unavailable ? (
                                        <Alert
                                            tone="warning"
                                            variant="inline"
                                            locale={locale}
                                        >
                                            {t('account.exclusiveDeals.item.listingUnavailable')}
                                        </Alert>
                                    ) : undefined
                                }
                                actions={
                                    deal.accommodationSlug
                                        ? [
                                              <LinkButton
                                                  key="open"
                                                  variant="secondary"
                                                  size="sm"
                                                  href={buildUrl({
                                                      locale,
                                                      path: `alojamientos/${deal.accommodationSlug}`
                                                  })}
                                              >
                                                  {t('account.exclusiveDeals.item.viewListing')}
                                              </LinkButton>
                                          ]
                                        : []
                                }
                            />
                        );
                    })}
                </DataList>
            )}
        />
    );
}

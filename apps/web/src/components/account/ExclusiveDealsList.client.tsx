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
 *  - Rows that are no longer inert, using only data the payload already has:
 *    the validity date, and a «Ver alojamiento» action for a deal tied to one
 *    accommodation (`accommodationId`). The listing page is addressed by slug,
 *    which the payload does not carry, so the action resolves it on click
 *    through the existing public `accommodations/:id` read (no real link is
 *    possible without a new API field). When that read says the listing is
 *    gone (404) the row says so inline and drops the action; any other
 *    failure says so inline and keeps the action for a retry. Owner-wide
 *    deals (`accommodationId` null) point nowhere and stay informational.
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
import {
    Alert,
    AsyncRegion,
    type AsyncResult,
    Button,
    DataList,
    EmptyState,
    ErrorState,
    ListRow,
    LockedState,
    Skeleton,
    StatusPill
} from '@/components/account/ui';
import { accommodationsApi } from '@/lib/api/endpoints';
import { resolvePlanGateMessage } from '@/lib/billing/plan-name-list';
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

/** Why a deal's listing could not be opened: gone for good, or a failed read. */
type ListingIssue = 'unavailable' | 'failed';

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
    const [deals, setDeals] = useState<OwnerPromotionListItem[]>([]);
    /** The deal whose listing link is being resolved, if any. */
    const [openingId, setOpeningId] = useState<string | null>(null);
    /** Per-deal inline message after a failed open, keyed by deal id. */
    const [listingIssues, setListingIssues] = useState<Readonly<Record<string, ListingIssue>>>({});

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

    // ── Row actions ───────────────────────────────────────────────────────────

    /**
     * Opens the listing a deal belongs to. The listing page is addressed by
     * slug and the deal carries only the accommodation id, so the slug is read
     * on click from the existing public `accommodations/:id` endpoint.
     */
    async function openListing(deal: OwnerPromotionListItem): Promise<void> {
        if (!deal.accommodationId || openingId !== null) return;
        setOpeningId(deal.id);
        const flag = (issue: ListingIssue | null): void => {
            if (!isMountedRef.current) return;
            setListingIssues((current) => {
                const { [deal.id]: _previous, ...rest } = current;
                return issue === null ? rest : { ...rest, [deal.id]: issue };
            });
        };
        try {
            const result = await accommodationsApi.getById({ id: deal.accommodationId });
            if (!result.ok && result.error.status === 404) {
                flag('unavailable');
                return;
            }
            const slug = result.ok ? result.data.slug : undefined;
            if (!slug) throw new Error('listing slug unavailable');
            flag(null);
            window.location.assign(buildUrl({ locale, path: `alojamientos/${slug}` }));
        } catch (err) {
            webLogger.error('[ExclusiveDealsList] failed to resolve the listing', err);
            flag('failed');
        } finally {
            if (isMountedRef.current) setOpeningId(null);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    // Tourist-only Área Turista feature — the CTA must point at the tourist
    // pricing page, not the owner one (BETA-174).
    const upgradeHref = buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.tourist });

    const state: AsyncResult<readonly OwnerPromotionListItem[]> =
        status.kind === 'loading'
            ? { status: 'loading' }
            : status.kind === 'upgrade'
              ? {
                    status: 'locked',
                    reason: {
                        kind: 'plan',
                        feature: t('account.exclusiveDeals.upgrade.title', 'Ofertas exclusivas'),
                        description: resolvePlanGateMessage({
                            keyBase: 'account.exclusiveDeals.upgrade.message',
                            locale,
                            noPlansFallback:
                                'Las ofertas exclusivas no están incluidas en tu plan actual. Actualizá tu plan para acceder.',
                            planNames: gatePlanNames,
                            t
                        }),
                        // The description already names the catalog plans.
                        plans: [],
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
                        const issue = listingIssues[deal.id];
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
                                    issue ? (
                                        <Alert
                                            tone={issue === 'unavailable' ? 'warning' : 'danger'}
                                            variant="inline"
                                            locale={locale}
                                        >
                                            {issue === 'unavailable'
                                                ? t(
                                                      'account.exclusiveDeals.item.listingUnavailable'
                                                  )
                                                : t('account.exclusiveDeals.item.viewListingError')}
                                        </Alert>
                                    ) : undefined
                                }
                                actions={
                                    deal.accommodationId && issue !== 'unavailable'
                                        ? [
                                              <Button
                                                  key="open"
                                                  variant="secondary"
                                                  size="sm"
                                                  loading={openingId === deal.id}
                                                  onClick={() => void openListing(deal)}
                                              >
                                                  {t('account.exclusiveDeals.item.viewListing')}
                                              </Button>
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

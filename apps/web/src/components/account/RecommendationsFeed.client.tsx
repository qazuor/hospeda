/**
 * @file RecommendationsFeed.client.tsx
 * @description React island rendering the tourist-facing personalized
 * recommendations feed ("Sugerencias para vos") for the `/recomendaciones`
 * page (SPEC-284 T-011). The Astro host page itself is built separately (T-012).
 *
 * On mount, fetches `GET /api/v1/protected/recommendations` and renders one
 * of the following states:
 *  - **Loading** — skeleton placeholders + a labelled live region.
 *  - **Error** — the fetch failed or returned a non-2xx unexpected status;
 *    shows a retry action (same pattern as `SearchHistoryList.client.tsx`).
 *  - **Entitlement required** — a 403 response (best-effort: the exact
 *    entitlement-gate error contract is not finalized as of T-011; the API
 *    route itself, T-008, has not shipped yet). Renders the same rich
 *    plan-gate block as `AlertsList.client.tsx` / `ExclusiveDealsList.client.tsx`
 *    (title + Plus/VIP explanation + "Ver planes" CTA — BETA-168), not a
 *    retry action, since a retry cannot change the user's plan.
 *  - **Cold-start** — `isColdStart === true`. The feed IS populated (with a
 *    popular/featured fallback per spec §5.5); a banner is rendered above the
 *    normal grid, not an empty state.
 *  - **True-empty** — `items.length === 0 && isColdStart === false`.
 *  - **Populated, grouped** — the normal case: cards are grouped under a
 *    heading per recommendation reason (destination / type / other — BETA-152).
 *    Cold-start skips grouping and renders one flat grid (no personal signal).
 *
 * HOS-2501: the cards are kit `EntityCard`s sitting straight on the page
 * background (never inside a Section box), the async states are kit
 * `Skeleton`, `ErrorState`, `EmptyState` and `LockedState` (catalog plan names
 * from the SSR page), and the cold-start notice is a kit `Alert`.
 *
 * Hydration: caller should use `client:visible` — this is a below-the-fold
 * feed, not required immediately on paint (see apps/web CLAUDE.md client
 * directive guide).
 */

import { StarIcon } from '@repo/icons';
import { getMediaUrl } from '@repo/media';
import type {
    RecommendationFeedResponse,
    RecommendationReason,
    ScoredAccommodation
} from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './RecommendationsFeed.module.css';
import {
    Alert,
    EmptyState,
    EntityCard,
    EntityCardGrid,
    ErrorState,
    LinkButton,
    LockedState,
    Skeleton
} from './ui';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Envelope returned by `GET /api/v1/protected/recommendations`. */
interface RecommendationsApiResponse {
    readonly success: boolean;
    readonly data?: RecommendationFeedResponse;
    readonly error?: { readonly code?: string | null; readonly message?: string | null };
}

/** Props for the {@link RecommendationsFeed} island. */
export interface RecommendationsFeedProps {
    /** Active locale for i18n and detail-page URL building. */
    readonly locale: SupportedLocale;
    /** API base URL (`PUBLIC_API_URL`), passed by the Astro host page. */
    readonly apiUrl: string;
    /**
     * HOS-2554: catalog names of the plans that carry recommendations, read by the SSR page
     * (the catalog reader is server-only). Empty when the catalog could not be read.
     */
    readonly gatePlanNames?: readonly string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of skeleton cards shown while the feed is loading. */
const SKELETON_COUNT = 6;

/**
 * Order in which reason groups are rendered (BETA-152): strongest personal
 * signal first, discovery bucket last.
 */
const REASON_ORDER: readonly RecommendationReason[] = ['DESTINATION', 'TYPE', 'OTHER'];

/** i18n key + fallback copy for each reason group's heading. */
const REASON_HEADING: Readonly<
    Record<RecommendationReason, { readonly key: string; readonly fallback: string }>
> = {
    DESTINATION: {
        key: 'account.recommendations.groups.destination',
        fallback: 'Por los destinos que te gustan'
    },
    TYPE: { key: 'account.recommendations.groups.type', fallback: 'Del tipo que preferís' },
    OTHER: { key: 'account.recommendations.groups.other', fallback: 'Otras sugerencias para vos' }
};

/** A reason group: its reason and the items attributed to it (order preserved). */
interface ReasonGroup {
    readonly reason: RecommendationReason;
    readonly items: readonly ScoredAccommodation[];
}

/**
 * Buckets scored items into reason groups in {@link REASON_ORDER}, preserving
 * each item's incoming order (already ranked by `totalScore`). A missing
 * `reason` defaults to `OTHER` defensively. Empty groups are dropped.
 */
function groupByReason(items: readonly ScoredAccommodation[]): readonly ReasonGroup[] {
    return REASON_ORDER.map((reason) => ({
        reason,
        items: items.filter((item) => (item.reason ?? 'OTHER') === reason)
    })).filter((group) => group.items.length > 0);
}

// ─── RecommendationCard sub-component ──────────────────────────────────────────

/** Props for the {@link RecommendationCard} sub-component. */
interface RecommendationCardProps {
    /** Scored accommodation to render. */
    readonly scored: ScoredAccommodation;
    /** Active locale for the detail-page link and price formatting. */
    readonly locale: SupportedLocale;
    /** Translation function from `createTranslations(locale)`. */
    readonly t: ReturnType<typeof createTranslations>['t'];
}

/**
 * One recommended accommodation as a kit `EntityCard`: image (card preset),
 * name linking to the detail page, rating, price and a «Ver alojamiento» link.
 */
function RecommendationCard({ scored, locale, t }: RecommendationCardProps) {
    const { accommodation } = scored;
    const detailHref = buildUrl({ locale, path: `/alojamientos/${accommodation.slug}/` });
    const rawThumbnail = accommodation.media?.featuredImage?.url ?? null;
    const thumbnail = rawThumbnail ? getMediaUrl(rawThumbnail, { preset: 'card' }) : null;

    const priceValue = accommodation.price?.price;
    const formattedPrice =
        priceValue == null
            ? null
            : formatPrice({
                  amount: priceValue,
                  currency: accommodation.price?.currency ?? 'ARS',
                  locale
              });

    const rating = accommodation.averageRating;
    const hasRating = typeof rating === 'number' && rating > 0;

    return (
        <EntityCard
            title={accommodation.name}
            locale={locale}
            href={detailHref}
            image={thumbnail ? { src: thumbnail, alt: '' } : undefined}
            meta={
                hasRating ? (
                    <span
                        className={styles.rating}
                        aria-hidden="true"
                    >
                        <StarIcon size="sm" />
                        {rating?.toFixed(1)}
                    </span>
                ) : undefined
            }
            actions={
                <LinkButton
                    href={detailHref}
                    variant="secondary"
                    size="sm"
                    aria-label={`${t('account.recommendations.viewDetails')}: ${accommodation.name}`}
                >
                    {t('account.recommendations.viewDetails')}
                </LinkButton>
            }
        >
            {formattedPrice && <p className={styles.price}>{formattedPrice}</p>}
        </EntityCard>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Personalized recommendations feed island ("Sugerencias para vos").
 *
 * Fetches the authenticated user's recommendation feed on mount and renders
 * loading / error / entitlement-required / cold-start / empty / populated
 * states. See the file header for the full state matrix.
 *
 * @param props - {@link RecommendationsFeedProps}
 * @returns The recommendations feed island.
 */
export function RecommendationsFeed({
    locale,
    apiUrl,
    gatePlanNames = []
}: RecommendationsFeedProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    const [items, setItems] = useState<ScoredAccommodation[]>([]);
    const [isColdStart, setIsColdStart] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [entitlementRequired, setEntitlementRequired] = useState(false);

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Pre-compute translated strings referenced in callbacks, avoiding stale
    // deps on `t` (same pattern as SearchHistoryList / PreferenceToggles).
    const fetchErrorMsg = t(
        'account.recommendations.errorFetch',
        'No pudimos cargar tus recomendaciones'
    );

    // Same upgrade destination as AlertsList / ExclusiveDealsList / SearchHistoryList.
    // This is a tourist-only Área Turista feature — the CTA must point at the
    // tourist pricing page, not the owner one (BETA-174; previously all four
    // pointed at `suscriptores/planes`, the owner page, per the stale BETA-168 note).
    const upgradeHref = buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.tourist });

    const fetchFeed = useCallback(async () => {
        if (!isMountedRef.current) return;
        setLoading(true);
        setError(null);
        setEntitlementRequired(false);
        try {
            const res = await fetch(`${base}/api/v1/protected/recommendations`, {
                credentials: 'include'
            });

            if (res.status === 403) {
                if (isMountedRef.current) {
                    setEntitlementRequired(true);
                }
                return;
            }

            if (!res.ok) {
                throw new Error(fetchErrorMsg);
            }

            const body = (await res.json()) as RecommendationsApiResponse;
            if (!body.success || !body.data) {
                throw new Error(body.error?.message ?? fetchErrorMsg);
            }

            if (isMountedRef.current) {
                setItems(body.data.items);
                setIsColdStart(body.data.isColdStart);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : fetchErrorMsg);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [base, fetchErrorMsg]);

    useEffect(() => {
        void fetchFeed();
    }, [fetchFeed]);

    // ── Loading state ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className={styles.skeletonGrid}>
                {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                    <Skeleton
                        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders have no identity
                        key={index}
                        shape="block"
                        locale={locale}
                    />
                ))}
            </div>
        );
    }

    // ── Entitlement-required (plan-gate) state ────────────────────────────────
    // The plan names come from the catalog, read by the SSR page (HOS-2554).

    if (entitlementRequired) {
        return (
            <LockedState
                locale={locale}
                reason={{
                    kind: 'plan',
                    feature: t('account.recommendations.upgrade.title'),
                    description: t('account.pages.recommendations.description'),
                    plans: gatePlanNames.map((name) => ({ name })),
                    plansHref: upgradeHref
                }}
            />
        );
    }

    // ── Error state ───────────────────────────────────────────────────────────

    if (error) {
        return (
            <ErrorState
                locale={locale}
                description={error}
                onRetry={() => fetchFeed()}
            />
        );
    }

    // ── True-empty state ──────────────────────────────────────────────────────

    const isTrulyEmpty = items.length === 0 && !isColdStart;

    if (isTrulyEmpty) {
        return (
            <EmptyState
                title={t('account.recommendations.empty.title')}
                description={t('account.recommendations.empty.body')}
                action={
                    <LinkButton href={buildUrl({ locale, path: 'alojamientos' })}>
                        {t('account.recommendations.empty.cta')}
                    </LinkButton>
                }
            />
        );
    }

    // ── Cold-start notice + populated grid ────────────────────────────────────

    const cards = (list: readonly ScoredAccommodation[]) =>
        list.map((scored) => (
            <RecommendationCard
                key={scored.accommodation.id}
                scored={scored}
                locale={locale}
                t={t}
            />
        ));

    return (
        <div className={styles.root}>
            {isColdStart && (
                <Alert
                    tone="info"
                    locale={locale}
                    title={t('account.recommendations.coldStart.title')}
                >
                    {t('account.recommendations.coldStart.body')}
                </Alert>
            )}

            {isColdStart ? (
                <EntityCardGrid label={t('account.recommendations.listLabel')}>
                    {cards(items)}
                </EntityCardGrid>
            ) : (
                groupByReason(items).map((group) => {
                    const heading = t(REASON_HEADING[group.reason].key);
                    return (
                        <section
                            key={group.reason}
                            className={styles.group}
                            aria-labelledby={`rec-group-${group.reason}`}
                        >
                            <h2
                                id={`rec-group-${group.reason}`}
                                className={styles.groupHeading}
                            >
                                {heading}
                            </h2>
                            <EntityCardGrid label={heading}>{cards(group.items)}</EntityCardGrid>
                        </section>
                    );
                })
            )}
        </div>
    );
}

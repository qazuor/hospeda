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
 *    route itself, T-008, has not shipped yet). No retry action, since a
 *    retry cannot change the user's plan.
 *  - **Cold-start** — `isColdStart === true`. The feed IS populated (with a
 *    popular/featured fallback per spec §5.5); a banner is rendered above the
 *    normal grid, not an empty state.
 *  - **True-empty** — `items.length === 0 && isColdStart === false`.
 *  - **Populated, grouped** — the normal case: cards are grouped under a
 *    heading per recommendation reason (destination / type / other — BETA-152).
 *    Cold-start skips grouping and renders one flat grid (no personal signal).
 *
 * Card decision: `AccommodationCard.astro` cannot be used inside a React
 * island (established precedent — see `SearchChatPanel.client.tsx`'s
 * `ResultCard` and `BookmarkGrid.tsx`'s card). This file defines a
 * lightweight `RecommendationCard` sub-component mirroring the same visual
 * signals (image, title, price, rating) instead of reusing an Astro-only
 * component.
 *
 * Hydration: caller should use `client:visible` — this is a below-the-fold
 * feed, not required immediately on paint (see apps/web CLAUDE.md client
 * directive guide).
 */

import type {
    RecommendationFeedResponse,
    RecommendationReason,
    ScoredAccommodation
} from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SkeletonCardList } from '@/components/shared/feedback/SkeletonCard';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './RecommendationsFeed.module.css';

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
 * Compact accommodation card for the recommendations grid.
 *
 * `AccommodationCard.astro` cannot be used inside a React island, so this
 * renders the same visual signals (image, title, price, rating) as a
 * lightweight React equivalent — mirroring `ResultCard` in
 * `SearchChatPanel.client.tsx`.
 *
 * @param props - {@link RecommendationCardProps}
 * @returns A single grid item (`<li>`) for the recommendations list.
 */
function RecommendationCard({ scored, locale, t }: RecommendationCardProps) {
    const { accommodation } = scored;
    const detailHref = buildUrl({ locale, path: `/alojamientos/${accommodation.slug}/` });
    const thumbnail = accommodation.media?.featuredImage?.url ?? null;

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

    // Single wrapping anchor (not a title-link + separate CTA-link pair) —
    // `AccommodationCard.astro` cannot be reused inside a React island, and a
    // per-field link duplicates the same href as multiple tab stops. Mirrors
    // the `ResultCard` pattern in `SearchChatPanel.client.tsx`.
    return (
        <li className={styles.card}>
            <a
                href={detailHref}
                className={styles.cardLink}
                aria-label={accommodation.name}
            >
                <div className={styles.cardImage}>
                    {thumbnail ? (
                        <img
                            src={thumbnail}
                            alt=""
                            className={styles.cardImg}
                            loading="lazy"
                        />
                    ) : (
                        <div className={styles.cardImagePlaceholder}>
                            {t('common.noImage', 'Sin imagen')}
                        </div>
                    )}
                </div>

                <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{accommodation.name}</h3>

                    {hasRating && (
                        <p
                            className={styles.cardRating}
                            aria-hidden="true"
                        >
                            {'★'.repeat(Math.round(rating ?? 0))}
                            <span>{rating?.toFixed(1)}</span>
                        </p>
                    )}

                    {formattedPrice && <p className={styles.cardPrice}>{formattedPrice}</p>}

                    <span
                        className={styles.cardCta}
                        aria-hidden="true"
                    >
                        {t('account.recommendations.viewDetails', 'Ver alojamiento')}
                    </span>
                </div>
            </a>
        </li>
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
export function RecommendationsFeed({ locale, apiUrl }: RecommendationsFeedProps) {
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
            <div
                className={styles.loadingWrap}
                role="status"
                aria-live="polite"
                aria-busy="true"
                aria-label={t('account.recommendations.loading', 'Cargando recomendaciones...')}
            >
                <SkeletonCardList
                    count={SKELETON_COUNT}
                    cardHeight="16rem"
                    gap="var(--space-card-gap, 30px)"
                />
            </div>
        );
    }

    // ── Entitlement-required state ────────────────────────────────────────────

    if (entitlementRequired) {
        return (
            <div className={styles.entitlementWrap}>
                <p>
                    {t(
                        'account.recommendations.entitlementRequired',
                        'Esta función está disponible para suscriptores Plus y VIP.'
                    )}
                </p>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────────────────

    if (error) {
        return (
            <div
                className={styles.errorWrap}
                role="alert"
            >
                <p>{error}</p>
                <button
                    type="button"
                    className={styles.retryBtn}
                    onClick={() => void fetchFeed()}
                >
                    {t('common.retry', 'Reintentar')}
                </button>
            </div>
        );
    }

    // ── True-empty state ──────────────────────────────────────────────────────

    const isTrulyEmpty = items.length === 0 && !isColdStart;

    if (isTrulyEmpty) {
        return (
            <div
                className={styles.emptyWrap}
                aria-live="polite"
            >
                <p className={styles.emptyTitle}>
                    {t(
                        'account.recommendations.empty.title',
                        'No encontramos recomendaciones por ahora'
                    )}
                </p>
                <p className={styles.emptyBody}>
                    {t(
                        'account.recommendations.empty.body',
                        'Volvé más tarde o explorá todo nuestro catálogo de alojamientos.'
                    )}
                </p>
            </div>
        );
    }

    // ── Cold-start banner + populated grid ────────────────────────────────────

    return (
        <div className={styles.root}>
            {isColdStart && (
                <div
                    className={styles.coldStartBanner}
                    aria-live="polite"
                >
                    <p className={styles.coldStartTitle}>
                        {t(
                            'account.recommendations.coldStart.title',
                            'Todavía estamos conociendo tus gustos'
                        )}
                    </p>
                    <p className={styles.coldStartBody}>
                        {t(
                            'account.recommendations.coldStart.body',
                            'Mientras tanto, te mostramos alojamientos populares. Guardá favoritos, mirá alojamientos o hacé una búsqueda para recibir recomendaciones más precisas.'
                        )}
                    </p>
                </div>
            )}

            {isColdStart ? (
                // Cold-start has no personal signal, so grouping by reason would be
                // misleading — render one flat grid (every item is 'OTHER' anyway).
                <ul
                    className={styles.grid}
                    aria-label={t('account.recommendations.listLabel', 'Sugerencias para vos')}
                >
                    {items.map((scored) => (
                        <RecommendationCard
                            key={scored.accommodation.id}
                            scored={scored}
                            locale={locale}
                            t={t}
                        />
                    ))}
                </ul>
            ) : (
                // Personalized feed: group items under a heading per reason (BETA-152).
                groupByReason(items).map((group) => (
                    <section
                        key={group.reason}
                        className={styles.group}
                        aria-labelledby={`rec-group-${group.reason}`}
                    >
                        <h2
                            id={`rec-group-${group.reason}`}
                            className={styles.groupHeading}
                        >
                            {t(
                                REASON_HEADING[group.reason].key,
                                REASON_HEADING[group.reason].fallback
                            )}
                        </h2>
                        <ul className={styles.grid}>
                            {group.items.map((scored) => (
                                <RecommendationCard
                                    key={scored.accommodation.id}
                                    scored={scored}
                                    locale={locale}
                                    t={t}
                                />
                            ))}
                        </ul>
                    </section>
                ))
            )}
        </div>
    );
}

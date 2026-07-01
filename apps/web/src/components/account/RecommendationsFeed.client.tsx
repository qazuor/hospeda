/**
 * @file RecommendationsFeed.client.tsx
 * @description React island rendering the tourist-facing personalized
 * recommendations feed ("Para vos") for the `/recomendaciones` page
 * (SPEC-284 T-011). The Astro host page itself is built separately (T-012).
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
 *  - **Populated grid** — the normal case, one card per recommendation.
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

import { SkeletonCardList } from '@/components/shared/feedback/SkeletonCard';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import type { RecommendationFeedResponse, ScoredAccommodation } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
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
        priceValue != null
            ? formatPrice({
                  amount: priceValue,
                  currency: accommodation.price?.currency ?? 'ARS',
                  locale
              })
            : null;

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
 * Personalized recommendations feed island ("Para vos").
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

            <ul
                className={styles.grid}
                aria-label={t('account.recommendations.listLabel', 'Recomendaciones para vos')}
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
        </div>
    );
}

/**
 * @file UserReviewsList.client.tsx
 * @description React island that lists the authenticated user's reviews.
 *
 * Fetches GET /api/v1/protected/users/me/reviews on mount.
 * Renders a list of review cards showing: text, rating stars, entity link, date.
 * Read-only in beta (no inline edit/delete). 10 items per page.
 *
 * Hydration: caller must use `client:load`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { useCallback, useEffect, useState } from 'react';
import styles from './UserReviewsList.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const API_PATH = '/api/v1/protected/users/me/reviews';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single review item (accommodation or destination) */
interface ReviewItem {
    readonly id: string;
    /** Numeric rating 0-10 (stored as average across aspects or direct value) */
    readonly rating?: number | null;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly createdAt?: string | null;
    readonly entityId?: string | null;
    readonly entityName?: string | null;
    readonly entityUrl?: string | null;
    readonly type: 'accommodation' | 'destination';
}

/** Raw accommodation review from API */
interface RawAccommodationReview {
    readonly id: string;
    readonly rating?: {
        readonly cleanliness?: number;
        readonly hospitality?: number;
        readonly services?: number;
        readonly accuracy?: number;
        readonly communication?: number;
        readonly location?: number;
    } | null;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly createdAt?: string | null;
    readonly accommodationId?: string | null;
    readonly accommodationName?: string | null;
    readonly accommodationSlug?: string | null;
}

/** Raw destination review from API */
interface RawDestinationReview {
    readonly id: string;
    readonly rating?: number | null;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly createdAt?: string | null;
    readonly destinationId?: string | null;
    readonly destinationName?: string | null;
    readonly destinationSlug?: string | null;
}

/** API response for me/reviews */
interface ReviewsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly accommodationReviews: readonly RawAccommodationReview[];
        readonly destinationReviews: readonly RawDestinationReview[];
        readonly totals: {
            readonly accommodationReviews: number;
            readonly destinationReviews: number;
            readonly total: number;
        };
    };
    readonly error?: { readonly message: string };
}

interface UserReviewsListProps {
    /** Active locale for i18n strings */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) */
    readonly apiUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute average rating from multi-aspect object (0-10 scale, 2 decimal). */
function computeAverageRating(ratingObj: Record<string, number> | null | undefined): number | null {
    if (!ratingObj) return null;
    const values = Object.values(ratingObj).filter((v): v is number => typeof v === 'number');
    if (values.length === 0) return null;
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

/** Format ISO date string to locale-friendly short date. */
function formatDate(iso: string | null | undefined, locale: SupportedLocale): string {
    if (!iso) return '';
    try {
        const localeMap: Record<SupportedLocale, string> = {
            es: 'es-AR',
            en: 'en-US',
            pt: 'pt-BR'
        };
        return new Date(iso).toLocaleDateString(localeMap[locale], {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return iso;
    }
}

/** Normalise raw API reviews into a flat ReviewItem list sorted by date desc. */
function normaliseReviews(data: ReviewsApiResponse['data']): ReviewItem[] {
    if (!data) return [];
    const acc: ReviewItem[] = (data.accommodationReviews ?? []).map((r) => ({
        id: r.id,
        rating: computeAverageRating(r.rating as Record<string, number> | null | undefined),
        title: r.title,
        content: r.content,
        createdAt: r.createdAt,
        entityId: r.accommodationId,
        entityName: r.accommodationName,
        entityUrl: r.accommodationSlug ? `/alojamientos/${r.accommodationSlug}/` : null,
        type: 'accommodation' as const
    }));

    const dst: ReviewItem[] = (data.destinationReviews ?? []).map((r) => ({
        id: r.id,
        rating: typeof r.rating === 'number' ? r.rating : null,
        title: r.title,
        content: r.content,
        createdAt: r.createdAt,
        entityId: r.destinationId,
        entityName: r.destinationName,
        entityUrl: r.destinationSlug ? `/destinos/${r.destinationSlug}/` : null,
        type: 'destination' as const
    }));

    return [...acc, ...dst].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
    });
}

// ─── Empty state ──────────────────────────────────────────────────────────────

interface EmptyReviewsProps {
    readonly title: string;
    readonly description: string;
    readonly ctaLabel: string;
    readonly ctaHref: string;
}

function EmptyReviews({ title, description, ctaLabel, ctaHref }: EmptyReviewsProps) {
    return (
        <div className={styles.emptyState}>
            <div
                className={styles.emptyIcon}
                aria-hidden="true"
            >
                <svg
                    viewBox="0 0 24 24"
                    width="32"
                    height="32"
                    fill="currentColor"
                    role="presentation"
                >
                    <path d="M12 2.5l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.6l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.5z" />
                </svg>
            </div>
            <h3 className={styles.emptyTitle}>{title}</h3>
            <p className={styles.emptyText}>{description}</p>
            <a
                className={styles.emptyCta}
                href={ctaHref}
            >
                {ctaLabel}
            </a>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Reviews list island.
 * Read-only in beta — no inline edit or delete.
 */
export function UserReviewsList({ locale, apiUrl }: UserReviewsListProps) {
    const { t, tPlural } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const totalPages = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE));
    const pageReviews = reviews.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // ── Fetch all reviews (client-side pagination) ────────────────────────

    // Pre-compute the fetch-error fallback string here so the useCallback
    // below can depend on it without depending on `t` itself.
    // `createTranslations(locale)` returns a new object every render, so
    // putting `t` in the deps would re-create fetchReviews every render,
    // re-fire the useEffect below, and spam the API in an infinite loop.
    // The string returned from `t()` has value-based identity, so React
    // sees the same dep across renders.
    const fetchErrorMsg = t('account.reviews.errors.fetchFailed', 'Error al cargar reseñas');

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${base}${API_PATH}?type=all`, {
                credentials: 'include'
            });
            if (!res.ok) {
                throw new Error(fetchErrorMsg);
            }
            const body = (await res.json()) as ReviewsApiResponse;
            if (!body.success) {
                throw new Error(body.error?.message ?? fetchErrorMsg);
            }
            setReviews(normaliseReviews(body.data));
        } catch (err) {
            const msg = err instanceof Error ? err.message : fetchErrorMsg;
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [base, fetchErrorMsg]);

    useEffect(() => {
        void fetchReviews();
    }, [fetchReviews]);

    // ── Render ────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div
                className={styles.loadingWrap}
                aria-live="polite"
                aria-busy="true"
            >
                {t('common.loading', 'Cargando…')}
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={styles.errorWrap}
                role="alert"
            >
                {error}
            </div>
        );
    }

    if (reviews.length === 0) {
        return (
            <EmptyReviews
                title={t('account.reviews.emptyTitle', 'Todavía no escribiste reseñas')}
                description={t(
                    'account.reviews.empty',
                    'Visitá un alojamiento y compartí tu experiencia para ayudar a otros viajeros.'
                )}
                ctaLabel={t('account.reviews.emptyCta', 'Explorar alojamientos')}
                ctaHref={buildUrl({ locale, path: 'alojamientos' })}
            />
        );
    }

    return (
        <div className={styles.root}>
            <p className={styles.sectionTitle}>
                {tPlural('account.reviews.total', reviews.length, { count: reviews.length })}
            </p>

            {/* ── Review cards ────────────────────────────────────────── */}
            {pageReviews.map((review) => (
                <article
                    key={review.id}
                    className={styles.card}
                >
                    <div className={styles.cardHeader}>
                        {/* Entity name + link */}
                        {review.entityUrl ? (
                            <a
                                href={review.entityUrl}
                                className={styles.entityLink}
                            >
                                {review.entityName ?? t('common.untitled', 'Sin título')}
                            </a>
                        ) : (
                            <span className={styles.entityName}>
                                {review.entityName ?? t('common.untitled', 'Sin título')}
                            </span>
                        )}

                        {/* Rating + date + type badges */}
                        <div className={styles.cardMeta}>
                            {review.rating !== null && review.rating !== undefined && (
                                <span
                                    className={styles.ratingBadge}
                                    aria-label={`${t('account.reviews.ratingLabel', 'Calificación')}: ${review.rating}`}
                                >
                                    ★ {review.rating}
                                </span>
                            )}
                            {review.createdAt && (
                                <span className={styles.dateMeta}>
                                    {formatDate(review.createdAt, locale)}
                                </span>
                            )}
                            <span className={styles.typeMeta}>
                                {review.type === 'accommodation'
                                    ? t('account.reviews.typeAccommodation', 'Alojamiento')
                                    : t('account.reviews.typeDestination', 'Destino')}
                            </span>
                        </div>
                    </div>

                    {/* Review title (user-supplied) */}
                    {review.title && <h4 className={styles.reviewTitle}>{review.title}</h4>}

                    {/* Review text */}
                    {review.content && <p className={styles.reviewText}>{review.content}</p>}
                </article>
            ))}

            {/* ── Pagination ─────────────────────────────────────────── */}
            {totalPages > 1 && (
                <nav
                    className={styles.pagination}
                    aria-label={t('common.pagination', 'Paginación')}
                >
                    <button
                        type="button"
                        className={styles.pageBtn}
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label={t('common.prevPage', 'Página anterior')}
                    >
                        {t('common.prev', 'Anterior')}
                    </button>
                    <span className={styles.pageInfo}>
                        {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        className={styles.pageBtn}
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-label={t('common.nextPage', 'Página siguiente')}
                    >
                        {t('common.next', 'Siguiente')}
                    </button>
                </nav>
            )}
        </div>
    );
}

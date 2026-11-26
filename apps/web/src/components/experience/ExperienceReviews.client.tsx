/**
 * @file ExperienceReviews.client.tsx
 * @description Interactive reviews island for experience detail pages (SPEC-240 T-028).
 *
 * Renders:
 * - Aggregate rating badge (stars + score + count).
 * - List of published reviews (SSR-provided initial slice, expandable).
 * - "Load more" pagination trigger via the public reviews endpoint.
 *
 * Review submission (AC-3.1..AC-3.3) is behind authentication — the submit
 * button is only shown when the page detects an authenticated user and the
 * user has not yet submitted a review for this experience. The actual POST
 * goes to `/api/v1/protected/experiences/:id/reviews`.
 *
 * Hydration: caller MUST use `client:visible`.
 */

import { StarIcon } from '@repo/icons';
import { type FormEvent, useState } from 'react';
import { ListingReviewCta } from '@/components/listing/ListingReviewCta';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { apiClient } from '@/lib/api/client';
import type { ExperienceReviewPublicItem } from '@/lib/api/endpoints';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolveReviewCardRating } from '@/lib/review-card-rating';

// API base URL — must be absolute (web app on host A, API on host B)
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ─── Types ───────────────────────────────────────────────────────────────────

/** Props for the ExperienceReviews island. */
export interface ExperienceReviewsProps {
    /** Experience UUID (used for the reviews API path). */
    readonly experienceId: string;
    /** Initial slice of reviews (SSR-provided, avoids layout shift). */
    readonly initialReviews: readonly ExperienceReviewPublicItem[];
    /** Total number of published reviews for this experience. */
    readonly totalReviews: number;
    /** Aggregate star rating (0–5). */
    readonly averageRating: number;
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
    readonly signInHref: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fixed star positions (1-5); stable keys avoid array-index keying. */
const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

/** Renders filled/empty stars with `StarIcon` (HOS-2579 §6.7: no text glyphs). */
function StarRow({ rating, size = 16 }: { readonly rating: number; readonly size?: number }) {
    const full = Math.floor(rating);
    return (
        <span
            aria-hidden="true"
            style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}
        >
            {STAR_POSITIONS.map((position) => (
                <StarIcon
                    key={position}
                    size={size}
                    weight="fill"
                    color={position <= full ? 'var(--rating-star)' : 'var(--core-muted-foreground)'}
                    style={{ opacity: position <= full ? 1 : 0.4 }}
                    aria-hidden="true"
                />
            ))}
        </span>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ExperienceReviews — interactive reviews island for the experience detail page.
 *
 * Shows the SSR-provided initial reviews and allows loading more via the public
 * reviews API. The submit CTA is shown only for authenticated users.
 *
 * @param props - Component props (see {@link ExperienceReviewsProps})
 */
export function ExperienceReviews({
    experienceId,
    initialReviews,
    totalReviews,
    averageRating,
    signInHref,
    locale
}: ExperienceReviewsProps) {
    const { t, tPlural } = createTranslations(locale);

    // Session resolved client-side (HOS-369 WB0-4). The reviews themselves are
    // public and stay server-rendered; only the CTA depends on the visitor.
    const { user } = useAccountPermissions();
    const isAuthenticated = user !== null;
    const [formOpen, setFormOpen] = useState(false);
    const [submission, setSubmission] = useState<'idle' | 'sending' | 'pending' | 'error'>('idle');

    async function submitReview(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submission === 'sending') return;
        const data = new FormData(event.currentTarget);
        const content = String(data.get('content') ?? '').trim();
        if (content && content.length < 10) {
            setSubmission('error');
            return;
        }
        setSubmission('sending');
        const result = await apiClient.postProtected({
            path: `/api/v1/protected/experiences/${encodeURIComponent(experienceId)}/reviews`,
            body: { overallRating: Number(data.get('rating')), ...(content ? { content } : {}) }
        });
        setSubmission(result.success ? 'pending' : 'error');
    }

    const [reviews, setReviews] = useState<readonly ExperienceReviewPublicItem[]>(initialReviews);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(totalReviews > initialReviews.length);

    async function loadMore(): Promise<void> {
        setIsLoading(true);
        try {
            const nextPage = page + 1;
            const res = await fetch(
                `${API_BASE}/api/v1/public/experiences/${experienceId}/reviews?page=${nextPage}&pageSize=5`
            );
            if (!res.ok) return;
            const body = (await res.json()) as {
                data?: {
                    items?: ExperienceReviewPublicItem[];
                    pagination?: { totalPages?: number };
                };
            };
            const newItems = body.data?.items ?? [];
            const totalPages = body.data?.pagination?.totalPages ?? 1;
            setReviews((prev) => [...prev, ...newItems]);
            setPage(nextPage);
            setHasMore(nextPage < totalPages);
        } catch {
            // silent — reviews load failure is non-critical
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <section
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4, 16px)',
                marginBottom: 'var(--space-6, 24px)'
            }}
        >
            {/* Section heading + aggregate rating */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}
            >
                <h2
                    style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        color: 'var(--core-foreground)',
                        margin: 0
                    }}
                >
                    {t('experience.reviews.title', 'Reseñas')}
                </h2>
                {averageRating > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontFamily: 'var(--font-sans)'
                        }}
                    >
                        <StarRow rating={averageRating} />
                        <span
                            style={{
                                fontWeight: 700,
                                fontSize: '1.1rem',
                                color: 'var(--core-foreground)'
                            }}
                        >
                            {averageRating.toFixed(1)}
                        </span>
                        {totalReviews > 0 && (
                            <span
                                style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--core-muted-foreground)'
                                }}
                            >
                                ({totalReviews})
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Empty state */}

            {/* Review list */}
            {reviews.length > 0 && (
                <ul
                    style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-4, 16px)'
                    }}
                >
                    {reviews.map((review) => {
                        const cardRating = resolveReviewCardRating(review);
                        return (
                            <li
                                key={review.id}
                                style={{
                                    padding: 'var(--space-4, 16px)',
                                    backgroundColor: 'var(--core-card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md, 12px)'
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: '6px'
                                    }}
                                >
                                    <p
                                        style={{
                                            fontFamily: 'var(--font-sans)',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            color: 'var(--core-foreground)',
                                            margin: 0
                                        }}
                                    >
                                        {review.user?.name ?? t('common.anonymous')}
                                    </p>
                                    {cardRating != null && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <StarRow
                                                rating={cardRating}
                                                size={13}
                                            />
                                            <span
                                                style={{
                                                    fontFamily: 'var(--font-sans)',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 500,
                                                    color: 'var(--rating-star)'
                                                }}
                                            >
                                                {cardRating.toFixed(1)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {review.title && (
                                    <p
                                        style={{
                                            fontFamily: 'var(--font-sans)',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            color: 'var(--core-foreground)',
                                            marginBottom: '4px',
                                            marginTop: 0
                                        }}
                                    >
                                        {review.title}
                                    </p>
                                )}
                                {review.content && (
                                    <p
                                        style={{
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: '0.9rem',
                                            lineHeight: 1.5,
                                            color: 'var(--core-muted-foreground)',
                                            margin: 0
                                        }}
                                    >
                                        {review.content}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Load more button */}
            {hasMore && (
                <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={isLoading}
                    aria-busy={isLoading}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 24px',
                        borderRadius: 'var(--radius-pill, 9999px)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--core-card)',
                        color: 'var(--brand-primary)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.7 : 1,
                        transition: 'opacity 150ms ease-out',
                        width: 'fit-content',
                        alignSelf: 'center'
                    }}
                >
                    {isLoading ? (
                        <Spinner
                            size="sm"
                            label={t('experience.reviews.loading', 'Cargando reseñas…')}
                        />
                    ) : (
                        tPlural('experience.reviews.more', totalReviews - reviews.length)
                    )}
                </button>
            )}

            {/* Submit CTA — authenticated users only */}
            <ListingReviewCta
                locale={locale}
                signInHref={signInHref}
                empty={totalReviews === 0}
                onOpen={isAuthenticated ? () => setFormOpen(true) : undefined}
            >
                {submission === 'pending' ? (
                    <p role="status">{t('review.venueSidebar.pendingTitle')}</p>
                ) : isAuthenticated && formOpen ? (
                    <form onSubmit={submitReview}>
                        <label>
                            {t('review.form.overallLabel')}{' '}
                            <select
                                name="rating"
                                required
                            >
                                {STAR_POSITIONS.map((stars) => (
                                    <option
                                        key={stars}
                                        value={stars}
                                    >
                                        {stars}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            {t('review.form.contentLabel')}{' '}
                            <textarea
                                name="content"
                                minLength={10}
                                maxLength={2000}
                            />
                        </label>
                        {submission === 'error' && (
                            <p role="alert">{t('review.form.errors.submitFailed')}</p>
                        )}
                        <button
                            type="submit"
                            disabled={submission === 'sending'}
                        >
                            {t('review.form.submitButton')}
                        </button>
                    </form>
                ) : null}
            </ListingReviewCta>
        </section>
    );
}

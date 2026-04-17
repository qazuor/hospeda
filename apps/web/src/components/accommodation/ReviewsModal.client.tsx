import { GradientButton } from '@/components/ui/GradientButtonReact';
/**
 * @file ReviewsModal.client.tsx
 * @description Modal for browsing all paginated reviews.
 * Focus trap, Escape close, load more pagination.
 */
import { accommodationsApi } from '@/lib/api/endpoints';
import { getInitials } from '@/lib/api/transforms';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ReviewsModal.module.css';

interface ReviewItem {
    readonly id: string;
    readonly title?: string;
    readonly content?: string;
    readonly averageRating?: number;
    readonly user?: { readonly name: string | null; readonly image: string | null };
    readonly createdAt?: string;
}

interface ReviewsModalProps {
    readonly accommodationId: string;
    readonly reviewsCount: number;
    readonly locale: SupportedLocale;
}

export function ReviewsModal({ accommodationId, reviewsCount, locale }: ReviewsModalProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    const fetchReviews = useCallback(
        async (pageNum: number) => {
            setLoading(true);
            setError(false);
            try {
                const result = await accommodationsApi.getReviews({
                    id: accommodationId,
                    page: pageNum,
                    pageSize: 10
                });
                if (result.ok && result.data) {
                    const items = (result.data as { items?: readonly ReviewItem[] }).items ?? [];
                    setReviews((prev) => (pageNum === 1 ? [...items] : [...prev, ...items]));
                    const pagination = (result.data as { pagination?: { total?: number } })
                        .pagination;
                    setHasMore(pageNum * 10 < (pagination?.total ?? reviewsCount));
                } else {
                    setError(true);
                }
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        },
        [accommodationId, reviewsCount]
    );

    const open = useCallback(() => {
        setIsOpen(true);
        setPage(1);
        setReviews([]);
        setHasMore(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        triggerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchReviews(page);
        }
    }, [isOpen, page, fetchReviews]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, close]);

    // Listen for trigger button clicks from ReviewPreview
    useEffect(() => {
        const handler = (e: Event) => {
            const target = e.target as HTMLElement;
            const btn = target.closest('[data-reviews-modal-trigger]') as HTMLButtonElement | null;
            if (btn && btn.dataset.accommodationId === accommodationId) {
                triggerRef.current = btn;
                open();
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [accommodationId, open]);

    if (!isOpen) return null;

    return (
        <div
            className={styles.overlay}
            onClick={close}
            onKeyDown={(e) => {
                if (e.key === 'Escape') close();
            }}
            role="presentation"
        >
            <dialog
                ref={dialogRef}
                className={styles.modal}
                aria-modal="true"
                aria-labelledby="reviews-modal-title"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <h2
                        id="reviews-modal-title"
                        className={styles.title}
                    >
                        {t('accommodations.detail.reviewsDetail.modal.title')}
                    </h2>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={close}
                        aria-label={t('accommodations.detail.reviewsDetail.modal.close')}
                    >
                        &times;
                    </button>
                </div>

                <div className={styles.body}>
                    {reviews.map((review) => {
                        const userName = review.user?.name ?? 'Anónimo';
                        const initials = getInitials(userName);
                        const dateStr = review.createdAt
                            ? new Date(review.createdAt).toLocaleDateString(
                                  locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-AR',
                                  { year: 'numeric', month: 'short', day: 'numeric' }
                              )
                            : '';
                        return (
                            <article
                                key={review.id}
                                className={styles.reviewCard}
                            >
                                <div className={styles.reviewHeader}>
                                    {review.user?.image ? (
                                        <img
                                            src={review.user.image}
                                            alt={userName}
                                            className={styles.avatar}
                                        />
                                    ) : (
                                        <div className={styles.avatarFallback}>{initials}</div>
                                    )}
                                    <div className={styles.reviewMeta}>
                                        <span className={styles.reviewName}>{userName}</span>
                                        {dateStr && (
                                            <time className={styles.reviewDate}>{dateStr}</time>
                                        )}
                                    </div>
                                    {review.averageRating != null && (
                                        <span className={styles.reviewRating}>
                                            &#9733; {review.averageRating.toFixed(1)}
                                        </span>
                                    )}
                                </div>
                                {review.content && (
                                    <p className={styles.reviewContent}>{review.content}</p>
                                )}
                            </article>
                        );
                    })}

                    {loading && <div className={styles.spinner}>...</div>}

                    {error && !loading && (
                        <div className={styles.error}>
                            <p>{t('accommodations.detail.reviewsDetail.modal.error')}</p>
                            <GradientButton
                                as="button"
                                label={t('accommodations.detail.reviewsDetail.modal.retry')}
                                variant="outline-primary"
                                size="sm"
                                onClick={() => fetchReviews(page)}
                            />
                        </div>
                    )}

                    {!loading && !error && hasMore && reviews.length > 0 && (
                        <GradientButton
                            as="button"
                            label={t('accommodations.detail.reviewsDetail.modal.loadMore')}
                            variant="outline-primary"
                            size="sm"
                            shape="rounded"
                            className={styles.loadMoreBtn}
                            onClick={() => setPage((p) => p + 1)}
                        />
                    )}
                </div>
            </dialog>
        </div>
    );
}

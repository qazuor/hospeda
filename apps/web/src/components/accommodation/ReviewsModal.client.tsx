import { Spinner } from '@/components/shared/feedback/Spinner';
/**
 * @file ReviewsModal.client.tsx
 * @description Modal for browsing all paginated reviews. Cross-cutting modal
 * concerns (centering, scroll-lock, ESC, focus trap, click-outside) are
 * delegated to the shared `<Dialog>` component.
 */
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { accommodationsApi } from '@/lib/api/endpoints';
import { getInitialsFromName } from '@/lib/avatar-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ReviewsModal.module.css';

interface ReviewItem {
    readonly id: string;
    readonly title?: string;
    readonly content?: string;
    readonly averageRating?: number;
    readonly rating?: Readonly<Record<string, number>>;
    readonly user?: { readonly name: string | null; readonly image: string | null };
    readonly createdAt?: string;
}

const RATING_CATEGORIES = [
    'cleanliness',
    'hospitality',
    'services',
    'accuracy',
    'communication',
    'location'
] as const;

/**
 * Avatar with graceful broken-image fallback. Renders the initials behind a
 * stacked <img>; if the image errors (404, CORS, network) the img is hidden
 * and the initials become visible.
 */
function ReviewAvatar({
    url,
    alt,
    initials
}: { readonly url: string | null; readonly alt: string; readonly initials: string }) {
    const [broken, setBroken] = useState(false);
    return (
        <div className={styles.avatarWrapper}>
            {url && !broken && (
                <img
                    src={url}
                    alt={alt}
                    className={styles.avatar}
                    onError={() => setBroken(true)}
                />
            )}
            <div
                className={styles.avatarFallback}
                aria-hidden={url && !broken ? 'true' : undefined}
            >
                {initials}
            </div>
        </div>
    );
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

    return (
        <Dialog
            isOpen={isOpen}
            onClose={close}
            size="md"
            ariaLabelledBy="reviews-modal-title"
        >
            <DialogHeader
                titleId="reviews-modal-title"
                onClose={close}
                closeLabel={t('accommodations.detail.reviewsDetail.modal.close')}
            >
                {t('accommodations.detail.reviewsDetail.modal.title')}
            </DialogHeader>
            <DialogBody>
                <div className={styles.body}>
                    {reviews.map((review) => {
                        const userName = review.user?.name ?? 'Anónimo';
                        const initials = getInitialsFromName(userName);
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
                                    <ReviewAvatar
                                        url={review.user?.image ?? null}
                                        alt={userName}
                                        initials={initials}
                                    />
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
                                {review.rating && (
                                    <ul
                                        className={styles.breakdown}
                                        aria-label={t(
                                            'accommodations.detail.reviewsDetail.breakdownLabel'
                                        )}
                                    >
                                        {RATING_CATEGORIES.map((cat) => {
                                            const value = review.rating?.[cat];
                                            if (value == null) return null;
                                            const label = t(
                                                `accommodations.detail.reviewsDetail.categories.${cat}`
                                            );
                                            const pct = (value / 5) * 100;
                                            return (
                                                <li
                                                    key={cat}
                                                    className={styles.breakdownItem}
                                                >
                                                    <span className={styles.breakdownLabel}>
                                                        {label}
                                                    </span>
                                                    <span
                                                        className={styles.breakdownBar}
                                                        aria-hidden="true"
                                                    >
                                                        <span
                                                            className={styles.breakdownBarFill}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </span>
                                                    <span className={styles.breakdownValue}>
                                                        {value.toFixed(1)}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </article>
                        );
                    })}

                    {loading && (
                        <div
                            className={styles.spinnerWrapper}
                            aria-live="polite"
                        >
                            <Spinner
                                label={t(
                                    'accommodations.detail.reviewsDetail.modal.loading',
                                    'Cargando reseñas…'
                                )}
                            />
                        </div>
                    )}

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

                    {!error && hasMore && reviews.length > 0 && (
                        <GradientButton
                            as="button"
                            label={
                                loading
                                    ? t(
                                          'accommodations.detail.reviewsDetail.modal.loading',
                                          'Cargando reseñas…'
                                      )
                                    : t(
                                          'accommodations.detail.reviewsDetail.modal.loadMore',
                                          'Cargar más'
                                      )
                            }
                            variant="outline-primary"
                            size="sm"
                            shape="rounded"
                            className={styles.loadMoreBtn}
                            disabled={loading}
                            aria-busy={loading}
                            onClick={() => setPage((p) => p + 1)}
                        />
                    )}
                </div>
            </DialogBody>
        </Dialog>
    );
}

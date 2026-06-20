/**
 * @file DestinationReviewsModal.client.tsx
 * @description Paginated reviews modal for a destination detail page.
 * Adapts the accommodation ReviewsModal pattern to destination reviews.
 * Per-review rating breakdown is intentionally omitted (16 dimensions would
 * overwhelm a compact review row). Shows: avatar, name, averageRating, title,
 * content, and createdAt.
 *
 * Trigger pattern: listens for clicks on `[data-reviews-modal-trigger]`
 * elements whose `data-destination-id` matches the `destinationId` prop.
 */

import { SkeletonCardList } from '@/components/shared/feedback/SkeletonCard';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { destinationsApi } from '@/lib/api/endpoints';
import { getInitialsFromName } from '@/lib/avatar-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './DestinationReviewsModal.module.css';

interface ReviewItem {
    readonly id: string;
    readonly title?: string;
    readonly content?: string;
    readonly averageRating?: number;
    readonly user?: { readonly name: string | null; readonly image: string | null };
    readonly createdAt?: string;
}

/**
 * Avatar with broken-image fallback. Renders initials behind a stacked <img>;
 * if the image errors the img is hidden and initials become visible.
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

export interface DestinationReviewsModalProps {
    readonly destinationId: string;
    readonly reviewsCount: number;
    readonly locale: SupportedLocale;
}

/**
 * Modal component for browsing paginated destination reviews.
 * Mount with `client:idle` on the destination detail page.
 */
export function DestinationReviewsModal({
    destinationId,
    reviewsCount,
    locale
}: DestinationReviewsModalProps) {
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
                const result = await destinationsApi.getReviews({
                    id: destinationId,
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
        [destinationId, reviewsCount]
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

    // Listen for trigger button clicks from DestinationReviewsSection
    useEffect(() => {
        const handler = (e: Event) => {
            const target = e.target as HTMLElement;
            const btn = target.closest('[data-reviews-modal-trigger]') as HTMLButtonElement | null;
            if (btn && btn.dataset.destinationId === destinationId) {
                triggerRef.current = btn;
                open();
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [destinationId, open]);

    return (
        <Dialog
            isOpen={isOpen}
            onClose={close}
            size="md"
            ariaLabelledBy="dest-reviews-modal-title"
        >
            <DialogHeader
                titleId="dest-reviews-modal-title"
                onClose={close}
                closeLabel={t('destination.detail.reviews.modal.close', 'Cerrar')}
            >
                {t('destination.detail.reviews.modal.title', 'Reseñas del destino')}
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
                                        <span
                                            className={styles.reviewRating}
                                            aria-label={`Calificación: ${review.averageRating.toFixed(1)}`}
                                        >
                                            &#9733; {review.averageRating.toFixed(1)}
                                        </span>
                                    )}
                                </div>
                                {review.title && (
                                    <p className={styles.reviewTitle}>{review.title}</p>
                                )}
                                {review.content && (
                                    <p className={styles.reviewContent}>{review.content}</p>
                                )}
                            </article>
                        );
                    })}

                    {!loading && !error && reviews.length === 0 && isOpen && (
                        <p className={styles.empty}>
                            {t(
                                'destination.detail.reviews.modal.empty',
                                'No hay reseñas disponibles.'
                            )}
                        </p>
                    )}

                    {loading && reviews.length === 0 && (
                        <div
                            className={styles.spinnerWrapper}
                            aria-live="polite"
                        >
                            <Spinner
                                label={t(
                                    'destination.detail.reviews.modal.loading',
                                    'Cargando reseñas…'
                                )}
                            />
                            <SkeletonCardList
                                count={3}
                                cardHeight="5rem"
                                gap="0.75rem"
                            />
                        </div>
                    )}

                    {loading && reviews.length > 0 && (
                        <div className={styles.spinnerWrapper}>
                            {/* Decorative — the load-more button's aria-busy + changing label announce. */}
                            <Spinner />
                        </div>
                    )}

                    {error && !loading && (
                        <div className={styles.error}>
                            <p>
                                {t(
                                    'destination.detail.reviews.modal.error',
                                    'No se pudieron cargar las reseñas.'
                                )}
                            </p>
                            <GradientButton
                                as="button"
                                label={t('destination.detail.reviews.modal.retry', 'Reintentar')}
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
                                          'destination.detail.reviews.modal.loading',
                                          'Cargando reseñas…'
                                      )
                                    : t(
                                          'destination.detail.reviews.modal.loadMore',
                                          'Cargar más reseñas'
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

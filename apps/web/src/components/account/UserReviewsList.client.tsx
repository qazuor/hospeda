import { formatDate, toBcp47Locale } from '@repo/i18n';
import { ChatIcon, DeleteIcon, EditIcon } from '@repo/icons';
/**
 * User reviews list component with tab filtering, inline edit, and delete support.
 *
 * Displays user's accommodation and destination reviews with pagination.
 * Fetches data from the protected reviews API endpoint.
 * Supports inline editing and deletion with a confirmation dialog.
 *
 * @example
 * ```tsx
 * <UserReviewsList locale="es" />
 * ```
 */
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { apiClient } from '../../lib/api/client';
import { userApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { addToast } from '../../store/toast-store';
import { type EditFormState, ReviewEditForm } from './ReviewEditForm.client';

interface UserReviewsListProps {
    readonly locale: 'es' | 'en' | 'pt';
}

type ReviewType = 'all' | 'accommodation' | 'destination';

interface ReviewItem {
    readonly id: string;
    readonly rating: number;
    readonly title: string;
    readonly content: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    /** Present on accommodation reviews */
    readonly accommodationId?: string;
    /** Present on destination reviews */
    readonly destinationId?: string;
}

interface TabConfig {
    readonly id: ReviewType;
    readonly label: string;
}

interface ReviewTotals {
    readonly accommodationReviews: number;
    readonly destinationReviews: number;
    readonly total: number;
}

/** Read-only star rating display */
function StarRating({ rating, label }: { readonly rating: number; readonly label: string }) {
    const maxStars = 5;
    return (
        <div
            className="flex items-center gap-1"
            aria-label={`${label}: ${rating}/${maxStars}`}
        >
            {Array.from({ length: maxStars }, (_, i) => {
                const starKey = `star-${String(i)}`;
                return (
                    <span
                        key={starKey}
                        className={`text-sm ${i < rating ? 'text-star' : 'text-text-tertiary'}`}
                        aria-hidden="true"
                    >
                        &#9733;
                    </span>
                );
            })}
            <span className="sr-only">{`${rating} / ${maxStars}`}</span>
        </div>
    );
}

/**
 * Determine the API endpoint path for a review.
 * These are placeholder paths until the API implements PATCH/DELETE for reviews.
 *
 * @param review - The review item to build the endpoint for
 * @returns The API path string for the given review
 */
function getReviewEndpoint(review: ReviewItem): string {
    if (review.accommodationId) {
        return `/api/v1/protected/accommodation-reviews/${review.id}`;
    }
    return `/api/v1/protected/destination-reviews/${review.id}`;
}

/**
 * Merge and sort reviews from accommodation and destination sources by date descending.
 *
 * @param accReviews - Accommodation review records from the API
 * @param destReviews - Destination review records from the API
 * @returns Merged and sorted array of ReviewItem
 */
function mergeReviews(
    accReviews: Record<string, unknown>[],
    destReviews: Record<string, unknown>[]
): ReviewItem[] {
    const mapped: ReviewItem[] = [
        ...accReviews.map((r) => ({
            id: r.id as string,
            rating: r.rating as number,
            title: r.title as string,
            content: r.content as string,
            createdAt: r.createdAt as string,
            updatedAt: r.updatedAt as string,
            accommodationId: r.accommodationId as string
        })),
        ...destReviews.map((r) => ({
            id: r.id as string,
            rating: r.rating as number,
            title: r.title as string,
            content: r.content as string,
            createdAt: r.createdAt as string,
            updatedAt: r.updatedAt as string,
            destinationId: r.destinationId as string
        }))
    ];
    return mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * User reviews list component.
 * Shows accommodation and destination reviews with tab filtering, pagination,
 * inline editing, and delete with confirmation.
 *
 * @param locale - Display locale for dates and translations
 */
export function UserReviewsList({ locale }: UserReviewsListProps) {
    const [activeTab, setActiveTab] = useState<ReviewType>('all');
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [totals, setTotals] = useState<ReviewTotals>({
        accommodationReviews: 0,
        destinationReviews: 0,
        total: 0
    });
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    /** ID of the review being edited inline; null means none */
    const [editingId, setEditingId] = useState<string | null>(null);
    /** IDs of reviews with a PATCH request in flight */
    const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set());
    /** IDs of reviews with a DELETE request in flight */
    const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(new Set());

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'account' });
    const { t: tUi } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });

    const tabs: TabConfig[] = [
        { id: 'all', label: t('reviews.tabs.all') },
        { id: 'accommodation', label: t('reviews.tabs.accommodation') },
        { id: 'destination', label: t('reviews.tabs.destination') }
    ];

    /** Fetch reviews for the current tab and page */
    const fetchReviews = useCallback(
        async (resetPage = false) => {
            setIsLoading(true);
            try {
                const currentPage = resetPage ? 1 : page;
                const result = await userApi.getReviews({
                    type: activeTab,
                    page: currentPage,
                    pageSize: 10
                });

                if (result.ok && result.data) {
                    const merged = mergeReviews(
                        result.data.accommodationReviews as unknown as Record<string, unknown>[],
                        result.data.destinationReviews as unknown as Record<string, unknown>[]
                    );
                    setReviews((prev) => (resetPage ? merged : [...prev, ...merged]));
                    setTotals(result.data.totals);
                    if (!resetPage) setPage(currentPage + 1);
                } else {
                    addToast({ type: 'error', message: t('reviews.fetchError') });
                }
            } catch (error) {
                addToast({ type: 'error', message: t('reviews.fetchError') });
                webLogger.error('Error fetching reviews:', error);
            } finally {
                setIsLoading(false);
            }
        },
        [activeTab, page, t]
    );

    const handleTabChange = (tabId: ReviewType) => {
        setActiveTab(tabId);
        setReviews([]);
        setPage(1);
        setEditingId(null);
    };

    const handleLoadMore = (e: FormEvent) => {
        e.preventDefault();
        fetchReviews();
    };

    /**
     * Save edited review via PATCH (placeholder endpoint).
     *
     * @param id - ID of the review to update
     * @param data - Updated form state values
     */
    const handleSave = async (id: string, data: EditFormState) => {
        const review = reviews.find((r) => r.id === id);
        if (!review) return;

        setSavingIds((prev) => new Set([...prev, id]));
        try {
            const result = await apiClient.patch<ReviewItem>({
                path: getReviewEndpoint(review),
                body: { rating: data.rating, title: data.title, content: data.content }
            });

            if (result.ok) {
                setReviews((prev) =>
                    prev.map((r) =>
                        r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
                    )
                );
                setEditingId(null);
                addToast({ type: 'success', message: t('reviews.updateSuccess') });
            } else {
                addToast({ type: 'error', message: t('reviews.updateError') });
            }
        } catch (error) {
            webLogger.error('Error updating review:', error);
            addToast({ type: 'error', message: t('reviews.updateError') });
        } finally {
            setSavingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    /**
     * Delete review via DELETE after window.confirm (placeholder endpoint).
     *
     * @param review - The review item to delete
     */
    const handleDelete = async (review: ReviewItem) => {
        if (!window.confirm(t('reviews.deleteConfirm'))) return;

        setDeletingIds((prev) => new Set([...prev, review.id]));
        try {
            const result = await apiClient.delete<{ success: boolean }>({
                path: getReviewEndpoint(review)
            });

            if (result.ok) {
                setReviews((prev) => prev.filter((r) => r.id !== review.id));
                setTotals((prev) => ({
                    total: Math.max(0, prev.total - 1),
                    accommodationReviews: review.accommodationId
                        ? Math.max(0, prev.accommodationReviews - 1)
                        : prev.accommodationReviews,
                    destinationReviews: review.destinationId
                        ? Math.max(0, prev.destinationReviews - 1)
                        : prev.destinationReviews
                }));
                if (editingId === review.id) setEditingId(null);
                addToast({ type: 'success', message: t('reviews.deleteSuccess') });
            } else {
                addToast({ type: 'error', message: t('reviews.deleteError') });
            }
        } catch (error) {
            webLogger.error('Error deleting review:', error);
            addToast({ type: 'error', message: t('reviews.deleteError') });
        } finally {
            setDeletingIds((prev) => {
                const next = new Set(prev);
                next.delete(review.id);
                return next;
            });
        }
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally refetch when activeTab changes; fetchReviews captures latest state via closure
    useEffect(() => {
        fetchReviews(true);
    }, [activeTab]);

    const currentTotal =
        activeTab === 'all'
            ? totals.total
            : activeTab === 'accommodation'
              ? totals.accommodationReviews
              : totals.destinationReviews;

    const hasMore = reviews.length < currentTotal;

    return (
        <div className="user-reviews-list">
            {/* Tab Navigation */}
            <div className="mb-6 border-border border-b">
                <nav
                    className="flex gap-4"
                    role="tablist"
                    aria-label={tUi('accessibility.reviewCategories')}
                >
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-controls={`panel-${tab.id}`}
                            onClick={() => handleTabChange(tab.id)}
                            className={`border-b-2 px-4 py-3 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-secondary hover:border-border hover:text-text'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
            >
                {/* Initial loading */}
                {isLoading && reviews.length === 0 && (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
                        <span className="ml-3 text-text-secondary">{t('reviews.loading')}</span>
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && reviews.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ChatIcon
                            size="xl"
                            weight="regular"
                            className="mb-4 text-text-tertiary"
                        />
                        <h3 className="mb-2 font-semibold text-lg text-text">
                            {t('reviews.empty')}
                        </h3>
                        <p className="max-w-md text-sm text-text-secondary">
                            {t('reviews.emptyAction')}
                        </p>
                    </div>
                )}

                {/* Reviews */}
                {reviews.length > 0 && (
                    <div className="space-y-4">
                        {reviews.map((review) => {
                            const isEditing = editingId === review.id;
                            const isSaving = savingIds.has(review.id);
                            const isDeleting = deletingIds.has(review.id);
                            const isDisabled = isSaving || isDeleting;

                            return (
                                <div
                                    key={review.id}
                                    className={`rounded-lg border border-border p-4 transition-shadow ${
                                        isEditing
                                            ? 'border-primary/30 shadow-md'
                                            : 'hover:shadow-md'
                                    } ${isDeleting ? 'opacity-50' : ''}`}
                                >
                                    {isEditing ? (
                                        <ReviewEditForm
                                            review={review}
                                            messages={{
                                                ratingEditLabel: t('reviews.ratingEditLabel'),
                                                titleLabel: t('reviews.titleLabel'),
                                                contentLabel: t('reviews.contentLabel'),
                                                cancelButton: t('reviews.cancelButton'),
                                                saveButton: t('reviews.saveButton'),
                                                saving: t('reviews.saving')
                                            }}
                                            onSave={handleSave}
                                            onCancel={() => setEditingId(null)}
                                            isSaving={isSaving}
                                        />
                                    ) : (
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-2 flex items-center gap-3">
                                                    <StarRating
                                                        rating={review.rating}
                                                        label={t('reviews.ratingLabel')}
                                                    />
                                                    <span className="rounded-full bg-surface-alt px-2 py-0.5 text-text-secondary text-xs">
                                                        {review.accommodationId
                                                            ? t('reviews.accommodationReview')
                                                            : t('reviews.destinationReview')}
                                                    </span>
                                                </div>
                                                <h3 className="mb-1 font-semibold text-base text-text">
                                                    {review.title}
                                                </h3>
                                                <p className="line-clamp-3 text-sm text-text-secondary">
                                                    {review.content}
                                                </p>
                                                <p className="mt-2 text-text-tertiary text-xs">
                                                    {formatDate({
                                                        date: review.createdAt,
                                                        locale: toBcp47Locale(locale),
                                                        options: {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        }
                                                    })}
                                                </p>
                                            </div>
                                            {/* Edit / Delete buttons */}
                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(review.id)}
                                                    disabled={isDisabled}
                                                    aria-label={t('reviews.editButton')}
                                                    title={t('reviews.editButton')}
                                                    className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
                                                >
                                                    <EditIcon
                                                        size="sm"
                                                        weight="regular"
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(review)}
                                                    disabled={isDisabled}
                                                    aria-label={
                                                        isDeleting
                                                            ? t('reviews.deleting')
                                                            : t('reviews.deleteButton')
                                                    }
                                                    title={t('reviews.deleteButton')}
                                                    className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-error/10 hover:text-error focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-1 disabled:opacity-50"
                                                >
                                                    {isDeleting ? (
                                                        <div
                                                            className="h-4 w-4 animate-spin rounded-full border-error border-b-2"
                                                            role="status"
                                                        />
                                                    ) : (
                                                        <DeleteIcon
                                                            size="sm"
                                                            weight="regular"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Load More */}
                {hasMore && !isLoading && (
                    <div className="mt-8 flex justify-center">
                        <button
                            type="button"
                            onClick={handleLoadMore}
                            className="rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            {t('reviews.loadMore')}
                        </button>
                    </div>
                )}

                {/* Loading more indicator */}
                {isLoading && reviews.length > 0 && (
                    <div className="flex items-center justify-center py-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                    </div>
                )}
            </div>
        </div>
    );
}

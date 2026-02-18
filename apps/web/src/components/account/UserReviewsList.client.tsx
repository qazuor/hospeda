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
import { apiClient } from '../../lib/api/client';
import { userApi } from '../../lib/api/endpoints';
import { addToast } from '../../store/toast-store';
import { ReviewEditForm } from './ReviewEditForm';
import type { EditFormState } from './ReviewEditForm';
import { REVIEWS_MESSAGES, TAB_LABELS } from './user-reviews-i18n';

interface UserReviewsListProps {
    locale: 'es' | 'en' | 'pt';
}

type ReviewType = 'all' | 'accommodation' | 'destination';

interface ReviewItem {
    id: string;
    rating: number;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    /** Present on accommodation reviews */
    accommodationId?: string;
    /** Present on destination reviews */
    destinationId?: string;
}

interface TabConfig {
    id: ReviewType;
    label: string;
}

/** Read-only star rating display */
function StarRating({ rating, label }: { rating: number; label: string }) {
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
                        className={`text-sm ${i < rating ? 'text-yellow-500' : 'text-gray-300'}`}
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
 */
function getReviewEndpoint(review: ReviewItem): string {
    if (review.accommodationId) {
        return `/api/v1/protected/accommodation-reviews/${review.id}`;
    }
    return `/api/v1/protected/destination-reviews/${review.id}`;
}

/**
 * Merge and sort reviews from accommodation and destination sources by date descending.
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
 */
export function UserReviewsList({ locale }: UserReviewsListProps) {
    const [activeTab, setActiveTab] = useState<ReviewType>('all');
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [totals, setTotals] = useState({
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

    const messages = REVIEWS_MESSAGES[locale];
    const tabLabels = TAB_LABELS[locale];

    const tabs: TabConfig[] = [
        { id: 'all', label: tabLabels.all },
        { id: 'accommodation', label: tabLabels.accommodation },
        { id: 'destination', label: tabLabels.destination }
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
                    addToast({ type: 'error', message: messages.fetchError });
                }
            } catch (error) {
                addToast({ type: 'error', message: messages.fetchError });
                console.error('Error fetching reviews:', error);
            } finally {
                setIsLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeTab, page, messages.fetchError]
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
                addToast({ type: 'success', message: messages.updateSuccess });
            } else {
                addToast({ type: 'error', message: messages.updateError });
            }
        } catch (error) {
            console.error('Error updating review:', error);
            addToast({ type: 'error', message: messages.updateError });
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
     */
    const handleDelete = async (review: ReviewItem) => {
        if (!window.confirm(messages.deleteConfirm)) return;

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
                addToast({ type: 'success', message: messages.deleteSuccess });
            } else {
                addToast({ type: 'error', message: messages.deleteError });
            }
        } catch (error) {
            console.error('Error deleting review:', error);
            addToast({ type: 'error', message: messages.deleteError });
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
            <div className="mb-6 border-gray-200 border-b">
                <nav
                    className="flex gap-4"
                    role="tablist"
                    aria-label="Review categories"
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
                                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
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
                        <span className="ml-3 text-gray-600">{messages.loading}</span>
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && reviews.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ChatIcon
                            size="xl"
                            weight="regular"
                            className="mb-4 text-gray-400"
                        />
                        <h3 className="mb-2 font-semibold text-gray-900 text-lg">
                            {messages.empty}
                        </h3>
                        <p className="max-w-md text-gray-600 text-sm">{messages.emptyAction}</p>
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
                                    className={`rounded-lg border border-gray-200 p-4 transition-shadow ${
                                        isEditing
                                            ? 'border-primary/30 shadow-md'
                                            : 'hover:shadow-md'
                                    } ${isDeleting ? 'opacity-50' : ''}`}
                                >
                                    {isEditing ? (
                                        <ReviewEditForm
                                            review={review}
                                            messages={messages}
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
                                                        label={messages.ratingLabel}
                                                    />
                                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 text-xs">
                                                        {review.accommodationId
                                                            ? messages.accommodationReview
                                                            : messages.destinationReview}
                                                    </span>
                                                </div>
                                                <h3 className="mb-1 font-semibold text-base text-gray-900">
                                                    {review.title}
                                                </h3>
                                                <p className="line-clamp-3 text-gray-600 text-sm">
                                                    {review.content}
                                                </p>
                                                <p className="mt-2 text-gray-500 text-xs">
                                                    {new Date(review.createdAt).toLocaleDateString(
                                                        locale,
                                                        {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        }
                                                    )}
                                                </p>
                                            </div>
                                            {/* Edit / Delete buttons */}
                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(review.id)}
                                                    disabled={isDisabled}
                                                    aria-label={messages.editButton}
                                                    title={messages.editButton}
                                                    className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
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
                                                            ? messages.deleting
                                                            : messages.deleteButton
                                                    }
                                                    title={messages.deleteButton}
                                                    className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50"
                                                >
                                                    {isDeleting ? (
                                                        <div
                                                            className="h-4 w-4 animate-spin rounded-full border-red-600 border-b-2"
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
                            className="rounded-lg bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            {messages.loadMore}
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

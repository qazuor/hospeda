import { AddIcon, ChatIcon, CheckCircleIcon, StarIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Individual review data structure
 */
export interface Review {
    readonly id: string;
    readonly authorName: string;
    readonly authorAvatar?: string;
    readonly rating: number;
    readonly title: string;
    readonly content: string;
    readonly date: string;
    readonly verified?: boolean;
}

/**
 * Props for the ReviewList component
 */
export interface ReviewListProps {
    /**
     * Array of reviews to display
     */
    readonly reviews: ReadonlyArray<Review>;

    /**
     * Total count of reviews (may be larger than reviews array for pagination)
     */
    readonly totalCount: number;

    /**
     * Locale for internationalization
     * @default 'es'
     */
    readonly locale?: string;

    /**
     * Whether the user is authenticated
     * @default false
     */
    readonly isAuthenticated?: boolean;

    /**
     * Callback fired when user clicks "Write a review" button
     */
    readonly onWriteReview?: () => void;

    /**
     * Callback fired when user clicks "Load more" button
     */
    readonly onLoadMore?: () => void;

    /**
     * Whether more reviews can be loaded
     * @default false
     */
    readonly hasMore?: boolean;

    /**
     * Current sort order
     * @default 'newest'
     */
    readonly sortBy?: 'newest' | 'highest' | 'lowest';

    /**
     * Callback fired when sort order changes
     */
    readonly onSortChange?: (sort: 'newest' | 'highest' | 'lowest') => void;

    /**
     * Additional CSS classes to apply to the container
     */
    readonly className?: string;
}

/**
 * ReviewList component
 *
 * PRESENTATIONAL COMPONENT. Receives reviews as props, does NOT fetch from API.
 * Displays a list of reviews with sorting, filtering, and pagination capabilities.
 * Includes header with total count and sort dropdown, review cards with author info,
 * rating, title, content, date, and verified badge.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <ReviewList
 *   reviews={reviews}
 *   totalCount={42}
 *   locale="es"
 *   isAuthenticated={true}
 *   onWriteReview={() => console.log('Write review')}
 *   onLoadMore={() => console.log('Load more')}
 *   hasMore={true}
 *   sortBy="newest"
 *   onSortChange={(sort) => console.log('Sort changed to:', sort)}
 * />
 * ```
 */
export function ReviewList({
    reviews,
    totalCount,
    locale = 'es',
    isAuthenticated = false,
    onWriteReview,
    onLoadMore,
    hasMore = false,
    sortBy = 'newest',
    onSortChange,
    className = ''
}: ReviewListProps): JSX.Element {
    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'review' });
    const { t: tUi } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });

    /**
     * Renders a star rating display
     */
    const renderStars = (rating: number): JSX.Element => {
        return (
            <div
                className="flex gap-0.5"
                role="img"
                aria-label={tUi('accessibility.ratingOutOf', undefined, { rating })}
            >
                {Array.from({ length: 5 }, (_, index) => {
                    const isFilled = index < Math.floor(rating);
                    const starId = `star-${rating}-${index}`;
                    return (
                        <StarIcon
                            key={starId}
                            size={20}
                            weight={isFilled ? 'fill' : 'regular'}
                            className={isFilled ? 'text-yellow-400' : 'text-gray-300'}
                            aria-hidden="true"
                        />
                    );
                })}
            </div>
        );
    };

    /**
     * Renders a review card
     */
    const renderReviewCard = (review: Review): JSX.Element => {
        return (
            <article
                key={review.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
                {/* Author and Rating */}
                <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        {review.authorAvatar ? (
                            <img
                                src={review.authorAvatar}
                                alt={review.authorName}
                                className="h-10 w-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-semibold text-white">
                                {review.authorName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{review.authorName}</h3>
                                {review.verified && (
                                    <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 font-medium text-green-700 text-xs">
                                        <CheckCircleIcon
                                            size={12}
                                            weight="fill"
                                            className="text-green-700"
                                            aria-hidden="true"
                                        />
                                        {t('list.verified')}
                                    </span>
                                )}
                            </div>
                            <time
                                className="text-gray-500 text-sm"
                                dateTime={review.date}
                            >
                                {new Date(review.date).toLocaleDateString(
                                    locale === 'es' ? 'es-AR' : locale === 'pt' ? 'pt-BR' : 'en-US',
                                    {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    }
                                )}
                            </time>
                        </div>
                    </div>
                    {renderStars(review.rating)}
                </div>

                {/* Review Content */}
                <h4 className="mb-2 font-semibold text-gray-900">{review.title}</h4>
                <p className="text-gray-600 leading-relaxed">{review.content}</p>
            </article>
        );
    };

    // Empty state
    if (reviews.length === 0) {
        return (
            <div className={`py-12 ${className}`.trim()}>
                <div className="text-center">
                    <ChatIcon
                        size={48}
                        weight="duotone"
                        className="mx-auto text-gray-400"
                        aria-hidden="true"
                    />
                    <h3 className="mt-4 font-semibold text-gray-900 text-lg">
                        {t('list.noReviews')}
                    </h3>
                    <p className="mt-2 text-gray-500 text-sm">{t('list.noReviewsDescription')}</p>
                    {isAuthenticated && onWriteReview && (
                        <button
                            type="button"
                            onClick={onWriteReview}
                            className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            {t('list.writeReview')}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`.trim()}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-2xl text-gray-900">{t('list.title')}</h2>
                    <p className="mt-1 text-gray-500 text-sm">
                        {t(
                            totalCount === 1 ? 'list.totalReviews_one' : 'list.totalReviews_other',
                            undefined,
                            { count: totalCount }
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="sort-select"
                            className="font-medium text-gray-700 text-sm"
                        >
                            {t('list.sortBy')}:
                        </label>
                        <select
                            id="sort-select"
                            value={sortBy}
                            onChange={(e) =>
                                onSortChange?.(e.target.value as 'newest' | 'highest' | 'lowest')
                            }
                            className="block rounded-md border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="newest">{t('list.sortNewest')}</option>
                            <option value="highest">{t('list.sortHighest')}</option>
                            <option value="lowest">{t('list.sortLowest')}</option>
                        </select>
                    </div>

                    {/* Write Review Button - only shown to authenticated users */}
                    {isAuthenticated && onWriteReview && (
                        <button
                            type="button"
                            onClick={onWriteReview}
                            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            <AddIcon
                                size={20}
                                weight="bold"
                                className="mr-2 text-white"
                                aria-hidden="true"
                            />
                            {t('list.writeReview')}
                        </button>
                    )}
                </div>
            </div>

            {/* Review List */}
            <div className="space-y-4">{reviews.map((review) => renderReviewCard(review))}</div>

            {/* Load More Button */}
            {hasMore && onLoadMore && (
                <div className="flex justify-center pt-4">
                    <button
                        type="button"
                        onClick={onLoadMore}
                        className="inline-flex items-center rounded-md border-2 border-primary bg-white px-6 py-3 text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t('list.loadMore')}
                    </button>
                </div>
            )}
        </div>
    );
}

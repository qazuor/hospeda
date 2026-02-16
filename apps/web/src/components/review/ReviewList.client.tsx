import type { JSX } from 'react';

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
    readonly locale?: 'es' | 'en';

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
 * Translations for the ReviewList component
 */
const translations = {
    es: {
        title: 'Reseñas',
        totalReviews: (count: number) => `${count} reseña${count !== 1 ? 's' : ''}`,
        sortBy: 'Ordenar por',
        sortNewest: 'Más recientes',
        sortHighest: 'Mejor valorados',
        sortLowest: 'Menor valorados',
        writeReview: 'Escribir reseña',
        loadMore: 'Cargar más',
        noReviews: 'Aún no hay reseñas',
        noReviewsDescription: 'Sé el primero en dejar una reseña',
        verified: 'Verificado'
    },
    en: {
        title: 'Reviews',
        totalReviews: (count: number) => `${count} review${count !== 1 ? 's' : ''}`,
        sortBy: 'Sort by',
        sortNewest: 'Newest',
        sortHighest: 'Highest rated',
        sortLowest: 'Lowest rated',
        writeReview: 'Write a review',
        loadMore: 'Load more',
        noReviews: 'No reviews yet',
        noReviewsDescription: 'Be the first to leave a review',
        verified: 'Verified'
    }
};

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
    onWriteReview,
    onLoadMore,
    hasMore = false,
    sortBy = 'newest',
    onSortChange,
    className = ''
}: ReviewListProps): JSX.Element {
    const t = translations[locale];

    /**
     * Renders a star rating display
     */
    const renderStars = (rating: number): JSX.Element => {
        return (
            <div
                className="flex gap-0.5"
                role="img"
                aria-label={`Rating: ${rating} out of 5 stars`}
            >
                {Array.from({ length: 5 }, (_, index) => {
                    const isFilled = index < Math.floor(rating);
                    const starId = `star-${rating}-${index}`;
                    return (
                        <svg
                            key={starId}
                            className={`h-5 w-5 ${isFilled ? 'text-yellow-400' : 'text-gray-300'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                        >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
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
                                        <svg
                                            className="h-3 w-3"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                            aria-hidden="true"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t.verified}
                                    </span>
                                )}
                            </div>
                            <time
                                className="text-gray-500 text-sm"
                                dateTime={review.date}
                            >
                                {new Date(review.date).toLocaleDateString(
                                    locale === 'es' ? 'es-ES' : 'en-US',
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
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                        />
                    </svg>
                    <h3 className="mt-4 font-semibold text-gray-900 text-lg">{t.noReviews}</h3>
                    <p className="mt-2 text-gray-500 text-sm">{t.noReviewsDescription}</p>
                    {onWriteReview && (
                        <button
                            type="button"
                            onClick={onWriteReview}
                            className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            {t.writeReview}
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
                    <h2 className="font-bold text-2xl text-gray-900">{t.title}</h2>
                    <p className="mt-1 text-gray-500 text-sm">{t.totalReviews(totalCount)}</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="sort-select"
                            className="font-medium text-gray-700 text-sm"
                        >
                            {t.sortBy}:
                        </label>
                        <select
                            id="sort-select"
                            value={sortBy}
                            onChange={(e) =>
                                onSortChange?.(e.target.value as 'newest' | 'highest' | 'lowest')
                            }
                            className="block rounded-md border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="newest">{t.sortNewest}</option>
                            <option value="highest">{t.sortHighest}</option>
                            <option value="lowest">{t.sortLowest}</option>
                        </select>
                    </div>

                    {/* Write Review Button */}
                    {onWriteReview && (
                        <button
                            type="button"
                            onClick={onWriteReview}
                            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            <svg
                                className="mr-2 h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                            {t.writeReview}
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
                        {t.loadMore}
                    </button>
                </div>
            )}
        </div>
    );
}

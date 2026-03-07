import { formatDate, toBcp47Locale } from '@repo/i18n';
import { AddIcon, ChatIcon, CheckCircleIcon, StarIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Individual review data structure.
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
 * Props for the ReviewList component.
 */
export interface ReviewListProps {
    /**
     * Array of reviews to display.
     */
    readonly reviews: ReadonlyArray<Review>;

    /**
     * Total count of reviews (may be larger than reviews array for pagination).
     */
    readonly totalCount: number;

    /**
     * Locale for internationalization.
     * @default 'es'
     */
    readonly locale?: string;

    /**
     * Whether the user is authenticated.
     * @default false
     */
    readonly isAuthenticated?: boolean;

    /**
     * Callback fired when user clicks "Write a review" button.
     */
    readonly onWriteReview?: () => void;

    /**
     * Callback fired when user clicks "Load more" button.
     */
    readonly onLoadMore?: () => void;

    /**
     * Whether more reviews can be loaded.
     * @default false
     */
    readonly hasMore?: boolean;

    /**
     * Current sort order.
     * @default 'newest'
     */
    readonly sortBy?: 'newest' | 'highest' | 'lowest';

    /**
     * Callback fired when sort order changes.
     */
    readonly onSortChange?: (sort: 'newest' | 'highest' | 'lowest') => void;

    /**
     * Additional CSS classes to apply to the container.
     */
    readonly className?: string;
}

/**
 * Renders an inline star rating display.
 *
 * @param rating - Numeric rating value (1-5)
 * @param ariaLabel - Accessible label for the rating group
 * @returns JSX star icons row
 */
function StarRating({ rating, ariaLabel }: { rating: number; ariaLabel: string }): JSX.Element {
    return (
        <div
            className="flex gap-0.5"
            role="img"
            aria-label={ariaLabel}
        >
            {Array.from({ length: 5 }, (_, index) => {
                const isFilled = index < Math.floor(rating);
                const starId = `star-${rating}-${index}`;
                return (
                    <StarIcon
                        key={starId}
                        size={20}
                        weight={isFilled ? 'fill' : 'regular'}
                        className={isFilled ? 'text-accent' : 'text-muted'}
                        aria-hidden="true"
                    />
                );
            })}
        </div>
    );
}

/**
 * ReviewList component.
 *
 * PRESENTATIONAL COMPONENT. Receives reviews as props, does NOT fetch from API.
 * Displays a list of reviews with sorting and pagination capabilities.
 * Includes a header with total count and sort dropdown, inline review cards with
 * author info, star rating, title, content, date, and verified badge.
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
    const { t, tPlural } = useTranslation({
        locale: locale as SupportedLocale,
        namespace: 'review'
    });
    const { t: tUi } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });

    // Empty state
    if (reviews.length === 0) {
        return (
            <div className={`py-12 ${className}`.trim()}>
                <div className="text-center">
                    <ChatIcon
                        size={48}
                        weight="duotone"
                        className="mx-auto text-muted-foreground"
                        aria-hidden="true"
                    />
                    <h3 className="mt-4 font-semibold text-foreground text-lg">
                        {t('list.noReviews')}
                    </h3>
                    <p className="mt-2 text-muted-foreground text-sm">
                        {t('list.noReviewsDescription')}
                    </p>
                    {isAuthenticated && onWriteReview && (
                        <button
                            type="button"
                            onClick={onWriteReview}
                            className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
                    <h2 className="font-bold text-2xl text-foreground">{t('list.title')}</h2>
                    <p className="mt-1 text-muted-foreground text-sm">
                        {tPlural('list.totalReviews', totalCount)}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="review-sort-select"
                            className="font-medium text-foreground text-sm"
                        >
                            {t('list.sortBy')}:
                        </label>
                        <select
                            id="review-sort-select"
                            value={sortBy}
                            onChange={(e) =>
                                onSortChange?.(e.target.value as 'newest' | 'highest' | 'lowest')
                            }
                            className="block rounded-md border border-border bg-card px-3 py-1.5 text-card-foreground text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
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
                            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            <AddIcon
                                size={20}
                                weight="bold"
                                className="mr-2"
                                aria-hidden="true"
                            />
                            {t('list.writeReview')}
                        </button>
                    )}
                </div>
            </div>

            {/* Review List */}
            <div className="space-y-4">
                {reviews.map((review) => (
                    <article
                        key={review.id}
                        className="rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover"
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
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                                        aria-hidden="true"
                                    >
                                        {review.authorName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-card-foreground">
                                            {review.authorName}
                                        </h3>
                                        {review.verified && (
                                            <span className="inline-flex items-center gap-1 rounded bg-secondary/10 px-2 py-0.5 font-medium text-secondary-foreground text-xs">
                                                <CheckCircleIcon
                                                    size={12}
                                                    weight="fill"
                                                    className="text-secondary"
                                                    aria-hidden="true"
                                                />
                                                {t('list.verified')}
                                            </span>
                                        )}
                                    </div>
                                    <time
                                        className="text-muted-foreground text-sm"
                                        dateTime={review.date}
                                    >
                                        {formatDate({
                                            date: review.date,
                                            locale: toBcp47Locale(locale),
                                            options: {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            }
                                        })}
                                    </time>
                                </div>
                            </div>
                            <StarRating
                                rating={review.rating}
                                ariaLabel={tUi('accessibility.ratingOutOf', undefined, {
                                    rating: review.rating
                                })}
                            />
                        </div>

                        {/* Review Content */}
                        <h4 className="mb-2 font-semibold text-card-foreground">{review.title}</h4>
                        <p className="text-muted-foreground leading-relaxed">
                            &ldquo;{review.content}&rdquo;
                        </p>
                    </article>
                ))}
            </div>

            {/* Load More Button */}
            {hasMore && onLoadMore && (
                <div className="flex justify-center pt-4">
                    <button
                        type="button"
                        onClick={onLoadMore}
                        className="inline-flex items-center rounded-md border-2 border-primary bg-card px-6 py-3 text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t('list.loadMore')}
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * Accommodation Reviews Tab Route
 *
 * Displays and manages reviews for a specific accommodation.
 */

import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id/reviews')({
    component: AccommodationReviewsPage
});

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: static star rating (always 5 stars)
                    key={i}
                    className={
                        i < Math.round(rating) ? 'text-yellow-500' : 'text-muted-foreground/30'
                    }
                >
                    ★
                </span>
            ))}
        </div>
    );
}

function AccommodationReviewsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: accommodation, isLoading } = useAccommodationQuery(id);

    const reviewsCount = accommodation?.reviewsCount || 0;
    const averageRating = accommodation?.averageRating || 0;

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={accommodationTabs}
                basePath={`/accommodations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.reviews')}</h2>

                {isLoading ? (
                    <div className="space-y-4">
                        <div className="h-32 animate-pulse rounded-md bg-muted" />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                                key={i}
                                className="h-24 animate-pulse rounded-md bg-muted"
                            />
                        ))}
                    </div>
                ) : reviewsCount === 0 ? (
                    <p className="text-muted-foreground">No reviews yet for this accommodation.</p>
                ) : (
                    <div className="space-y-6">
                        {/* Reviews Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Reviews Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <p className="text-muted-foreground text-sm">
                                            Average Rating
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <StarRating rating={averageRating} />
                                            <span className="font-semibold text-2xl">
                                                {averageRating.toFixed(1)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-muted-foreground text-sm">
                                            Total Reviews
                                        </p>
                                        <p className="font-semibold text-2xl">{reviewsCount}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Rating Distribution (Mock visualization) */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Rating Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => {
                                        const stars = 5 - i;
                                        const percentage = calculateDistribution(
                                            stars,
                                            averageRating,
                                            reviewsCount
                                        );

                                        return (
                                            <div
                                                key={stars}
                                                className="flex items-center gap-3"
                                            >
                                                <div className="w-20 text-sm">
                                                    <StarRating rating={stars} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="h-2 w-full rounded-full bg-muted">
                                                        <div
                                                            className="h-full rounded-full bg-yellow-500"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <span className="w-12 text-right text-muted-foreground text-sm">
                                                    {percentage}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Note about detailed reviews */}
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                            <p className="text-blue-900 text-sm">
                                <strong>Note:</strong> Detailed review listings will be available in
                                a future update. Currently showing aggregated review statistics
                                only.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Calculate distribution percentage for a given star rating
 * This is a mock calculation for visualization purposes
 */
function calculateDistribution(stars: number, averageRating: number, reviewsCount: number): number {
    if (reviewsCount === 0) return 0;

    const diff = Math.abs(stars - averageRating);

    if (diff < 0.5) return 40;
    if (diff < 1.0) return 30;
    if (diff < 1.5) return 20;
    if (diff < 2.0) return 10;

    return 5;
}

/**
 * Accommodation Reviews Tab Route
 *
 * Displays and manages reviews for a specific accommodation.
 */

import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { EntitlementGate } from '@qazuor/qzpay-react';
import { formatNumber } from '@repo/i18n';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id_/reviews')({
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
    const { t, locale } = useTranslations();
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
                    <p className="text-muted-foreground">
                        {t('admin-pages.accommodations.reviews.noReviews')}
                    </p>
                ) : (
                    <div className="space-y-6">
                        {/* Reviews Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.accommodations.reviews.summary')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <p className="text-muted-foreground text-sm">
                                            {t('admin-pages.accommodations.reviews.averageRating')}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <StarRating rating={averageRating} />
                                            <span className="font-semibold text-2xl">
                                                {formatNumber({
                                                    value: averageRating,
                                                    locale,
                                                    options: {
                                                        minimumFractionDigits: 1,
                                                        maximumFractionDigits: 1
                                                    }
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-muted-foreground text-sm">
                                            {t('admin-pages.accommodations.reviews.totalReviews')}
                                        </p>
                                        <p className="font-semibold text-2xl">{reviewsCount}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Rating Distribution (Mock visualization) */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.accommodations.reviews.ratingDistribution')}
                                </CardTitle>
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
                                                            className="h-full rounded-full bg-yellow-500 dark:bg-yellow-400"
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
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                            <p className="text-blue-900 text-sm dark:text-blue-200">
                                <strong>
                                    {t('admin-pages.accommodations.reviews.detailedNoteLabel')}
                                </strong>{' '}
                                {t('admin-pages.accommodations.reviews.detailedNote')}
                            </p>
                        </div>

                        {/* T-G-005: Gate for responding to reviews (placeholder for future implementation) */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.accommodations.reviews.respondTitle')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <EntitlementGate
                                    entitlementKey="respond-reviews"
                                    fallback={
                                        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                                            <p className="font-medium text-amber-900">
                                                {t(
                                                    'admin-pages.accommodations.reviews.respondProPremium'
                                                )}
                                            </p>
                                            <p className="mt-2 text-amber-800 text-sm">
                                                {t(
                                                    'admin-pages.accommodations.reviews.respondUpgrade'
                                                )}
                                            </p>
                                        </div>
                                    }
                                >
                                    <p className="text-muted-foreground text-sm">
                                        {t('admin-pages.accommodations.reviews.respondComingSoon')}
                                    </p>
                                </EntitlementGate>
                            </CardContent>
                        </Card>
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

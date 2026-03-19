/**
 * Accommodation Pricing Tab Route
 *
 * Displays and manages pricing for a specific accommodation.
 */

import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { formatCurrency } from '@repo/i18n';
import { createFileRoute } from '@tanstack/react-router';

import type {
    DiscountBadgeLabels,
    FeeBadgeLabels
} from '@/features/accommodations/components/pricing-components';
import { DiscountItem, FeeItem } from '@/features/accommodations/components/pricing-components';

export const Route = createFileRoute('/_authed/accommodations/$id_/pricing')({
    component: AccommodationPricingPage
});

function AccommodationPricingPage() {
    const { id } = Route.useParams();
    const { t, locale } = useTranslations();
    const { data: accommodation, isLoading } = useAccommodationQuery(id);

    const price = accommodation?.price;
    const basePrice = price?.price;
    const currency = price?.currency || 'ARS';
    const additionalFees = price?.additionalFees;
    const discounts = price?.discounts;

    const formatPrice = (amount?: number, curr?: string) => {
        if (amount === undefined) return 'N/A';
        return formatCurrency({
            value: amount,
            locale,
            currency: curr || currency
        });
    };

    const hasAdditionalFees =
        additionalFees && Object.values(additionalFees).some((fee) => fee !== undefined);
    const hasDiscounts =
        discounts && Object.values(discounts).some((discount) => discount !== undefined);

    // Build badge label objects once to avoid repetition
    const feeBadgeLabels: FeeBadgeLabels = {
        included: t('admin-pages.accommodations.pricing.badges.included'),
        optional: t('admin-pages.accommodations.pricing.badges.optional'),
        percentage: t('admin-pages.accommodations.pricing.badges.percentage'),
        perStay: t('admin-pages.accommodations.pricing.badges.perStay'),
        perNight: t('admin-pages.accommodations.pricing.badges.perNight'),
        perGuest: t('admin-pages.accommodations.pricing.badges.perGuest')
    };

    const discountBadgeLabels: DiscountBadgeLabels = {
        percentage: t('admin-pages.accommodations.pricing.badges.percentage'),
        perStay: t('admin-pages.accommodations.pricing.badges.perStay'),
        perNight: t('admin-pages.accommodations.pricing.badges.perNight')
    };

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={accommodationTabs}
                basePath={`/accommodations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.pricing')}</h2>

                {isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                                key={i}
                                className="h-32 animate-pulse rounded-md bg-muted"
                            />
                        ))}
                    </div>
                ) : !price || basePrice === undefined ? (
                    <p className="text-muted-foreground">
                        {t('admin-pages.accommodations.pricing.noData')}
                    </p>
                ) : (
                    <div className="space-y-6">
                        {/* Base Pricing */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.accommodations.pricing.basePricing')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-muted-foreground text-sm">
                                            {t('admin-pages.accommodations.pricing.pricePerNight')}
                                        </p>
                                        <p className="font-semibold text-2xl">
                                            {formatPrice(basePrice, currency)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-sm">
                                            {t('admin-pages.accommodations.pricing.currency')}
                                        </p>
                                        <Badge
                                            variant="outline"
                                            className="mt-1"
                                        >
                                            {currency}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Additional Fees */}
                        {hasAdditionalFees && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        {t('admin-pages.accommodations.pricing.additionalFees')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {additionalFees?.cleaning && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.cleaningFee'
                                                )}
                                                fee={additionalFees.cleaning}
                                                formatPrice={formatPrice}
                                                badges={feeBadgeLabels}
                                            />
                                        )}
                                        {additionalFees?.tax && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.tax'
                                                )}
                                                fee={additionalFees.tax}
                                                formatPrice={formatPrice}
                                                badges={feeBadgeLabels}
                                            />
                                        )}
                                        {additionalFees?.lateCheckout && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.lateCheckout'
                                                )}
                                                fee={additionalFees.lateCheckout}
                                                formatPrice={formatPrice}
                                                badges={feeBadgeLabels}
                                            />
                                        )}
                                        {additionalFees?.pets && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.petFee'
                                                )}
                                                fee={additionalFees.pets}
                                                formatPrice={formatPrice}
                                                badges={feeBadgeLabels}
                                            />
                                        )}
                                        {additionalFees?.parking && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.parking'
                                                )}
                                                fee={additionalFees.parking}
                                                formatPrice={formatPrice}
                                                badges={feeBadgeLabels}
                                            />
                                        )}
                                        {additionalFees?.extraGuest && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.extraGuest'
                                                )}
                                                fee={additionalFees.extraGuest}
                                                formatPrice={formatPrice}
                                                badges={feeBadgeLabels}
                                            />
                                        )}
                                        {additionalFees?.others?.map((other, index) => (
                                            <FeeItem
                                                // biome-ignore lint/suspicious/noArrayIndexKey: dynamic fee items may not have stable IDs
                                                key={index}
                                                name={other.name}
                                                fee={other}
                                                formatPrice={formatPrice}
                                                badges={feeBadgeLabels}
                                            />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Discounts */}
                        {hasDiscounts && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        {t('admin-pages.accommodations.pricing.discounts')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {discounts?.weekly && (
                                            <DiscountItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.discountsWeekly'
                                                )}
                                                discount={discounts.weekly}
                                                formatPrice={formatPrice}
                                                badges={discountBadgeLabels}
                                            />
                                        )}
                                        {discounts?.monthly && (
                                            <DiscountItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.discountsMonthly'
                                                )}
                                                discount={discounts.monthly}
                                                formatPrice={formatPrice}
                                                badges={discountBadgeLabels}
                                            />
                                        )}
                                        {discounts?.lastMinute && (
                                            <DiscountItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.discountsLastMinute'
                                                )}
                                                discount={discounts.lastMinute}
                                                formatPrice={formatPrice}
                                                badges={discountBadgeLabels}
                                            />
                                        )}
                                        {discounts?.others?.map((other, index) => (
                                            <DiscountItem
                                                // biome-ignore lint/suspicious/noArrayIndexKey: dynamic discount items may not have stable IDs
                                                key={index}
                                                name={other.name}
                                                discount={other}
                                                formatPrice={formatPrice}
                                                badges={discountBadgeLabels}
                                            />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

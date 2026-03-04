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
                                                badges={{
                                                    included: t(
                                                        'admin-pages.accommodations.pricing.badges.included'
                                                    ),
                                                    optional: t(
                                                        'admin-pages.accommodations.pricing.badges.optional'
                                                    ),
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    ),
                                                    perGuest: t(
                                                        'admin-pages.accommodations.pricing.badges.perGuest'
                                                    )
                                                }}
                                            />
                                        )}
                                        {additionalFees?.tax && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.tax'
                                                )}
                                                fee={additionalFees.tax}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    included: t(
                                                        'admin-pages.accommodations.pricing.badges.included'
                                                    ),
                                                    optional: t(
                                                        'admin-pages.accommodations.pricing.badges.optional'
                                                    ),
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    ),
                                                    perGuest: t(
                                                        'admin-pages.accommodations.pricing.badges.perGuest'
                                                    )
                                                }}
                                            />
                                        )}
                                        {additionalFees?.lateCheckout && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.lateCheckout'
                                                )}
                                                fee={additionalFees.lateCheckout}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    included: t(
                                                        'admin-pages.accommodations.pricing.badges.included'
                                                    ),
                                                    optional: t(
                                                        'admin-pages.accommodations.pricing.badges.optional'
                                                    ),
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    ),
                                                    perGuest: t(
                                                        'admin-pages.accommodations.pricing.badges.perGuest'
                                                    )
                                                }}
                                            />
                                        )}
                                        {additionalFees?.pets && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.petFee'
                                                )}
                                                fee={additionalFees.pets}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    included: t(
                                                        'admin-pages.accommodations.pricing.badges.included'
                                                    ),
                                                    optional: t(
                                                        'admin-pages.accommodations.pricing.badges.optional'
                                                    ),
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    ),
                                                    perGuest: t(
                                                        'admin-pages.accommodations.pricing.badges.perGuest'
                                                    )
                                                }}
                                            />
                                        )}
                                        {additionalFees?.parking && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.parking'
                                                )}
                                                fee={additionalFees.parking}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    included: t(
                                                        'admin-pages.accommodations.pricing.badges.included'
                                                    ),
                                                    optional: t(
                                                        'admin-pages.accommodations.pricing.badges.optional'
                                                    ),
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    ),
                                                    perGuest: t(
                                                        'admin-pages.accommodations.pricing.badges.perGuest'
                                                    )
                                                }}
                                            />
                                        )}
                                        {additionalFees?.extraGuest && (
                                            <FeeItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.fees.extraGuest'
                                                )}
                                                fee={additionalFees.extraGuest}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    included: t(
                                                        'admin-pages.accommodations.pricing.badges.included'
                                                    ),
                                                    optional: t(
                                                        'admin-pages.accommodations.pricing.badges.optional'
                                                    ),
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    ),
                                                    perGuest: t(
                                                        'admin-pages.accommodations.pricing.badges.perGuest'
                                                    )
                                                }}
                                            />
                                        )}
                                        {additionalFees?.others?.map((other, index) => (
                                            <FeeItem
                                                // biome-ignore lint/suspicious/noArrayIndexKey: dynamic fee items may not have stable IDs
                                                key={index}
                                                name={other.name}
                                                fee={other}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    included: t(
                                                        'admin-pages.accommodations.pricing.badges.included'
                                                    ),
                                                    optional: t(
                                                        'admin-pages.accommodations.pricing.badges.optional'
                                                    ),
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    ),
                                                    perGuest: t(
                                                        'admin-pages.accommodations.pricing.badges.perGuest'
                                                    )
                                                }}
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
                                                badges={{
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    )
                                                }}
                                            />
                                        )}
                                        {discounts?.monthly && (
                                            <DiscountItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.discountsMonthly'
                                                )}
                                                discount={discounts.monthly}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    )
                                                }}
                                            />
                                        )}
                                        {discounts?.lastMinute && (
                                            <DiscountItem
                                                name={t(
                                                    'admin-pages.accommodations.pricing.discountsLastMinute'
                                                )}
                                                discount={discounts.lastMinute}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    )
                                                }}
                                            />
                                        )}
                                        {discounts?.others?.map((other, index) => (
                                            <DiscountItem
                                                // biome-ignore lint/suspicious/noArrayIndexKey: dynamic discount items may not have stable IDs
                                                key={index}
                                                name={other.name}
                                                discount={other}
                                                formatPrice={formatPrice}
                                                badges={{
                                                    percentage: t(
                                                        'admin-pages.accommodations.pricing.badges.percentage'
                                                    ),
                                                    perStay: t(
                                                        'admin-pages.accommodations.pricing.badges.perStay'
                                                    ),
                                                    perNight: t(
                                                        'admin-pages.accommodations.pricing.badges.perNight'
                                                    )
                                                }}
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

type FeeData = {
    price?: number;
    currency?: string;
    isIncluded?: boolean;
    isOptional?: boolean;
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
};

type FeeBadgeLabels = {
    included: string;
    optional: string;
    percentage: string;
    perStay: string;
    perNight: string;
    perGuest: string;
};

type DiscountBadgeLabels = {
    percentage: string;
    perStay: string;
    perNight: string;
};

function FeeItem({
    name,
    fee,
    formatPrice,
    badges: badgeLabels
}: {
    name: string;
    fee: FeeData;
    formatPrice: (amount?: number, curr?: string) => string;
    badges: FeeBadgeLabels;
}) {
    const badges: string[] = [];
    if (fee.isIncluded) badges.push(badgeLabels.included);
    if (fee.isOptional) badges.push(badgeLabels.optional);
    if (fee.isPercent) badges.push(badgeLabels.percentage);
    if (fee.isPerStay) badges.push(badgeLabels.perStay);
    if (fee.isPerNight) badges.push(badgeLabels.perNight);
    if (fee.isPerGuest) badges.push(badgeLabels.perGuest);

    return (
        <div className="flex items-start justify-between border-b pb-3 last:border-0">
            <div>
                <p className="font-medium text-sm">{name}</p>
                {badges.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {badges.map((badge) => (
                            <Badge
                                key={badge}
                                variant="outline"
                                className="text-xs"
                            >
                                {badge}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
            <p className="font-semibold text-sm">
                {fee.isPercent && fee.price
                    ? `${fee.price}%`
                    : formatPrice(fee.price, fee.currency)}
            </p>
        </div>
    );
}

function DiscountItem({
    name,
    discount,
    formatPrice,
    badges: badgeLabels
}: {
    name: string;
    discount: FeeData;
    formatPrice: (amount?: number, curr?: string) => string;
    badges: DiscountBadgeLabels;
}) {
    const badges: string[] = [];
    if (discount.isPercent) badges.push(badgeLabels.percentage);
    if (discount.isPerStay) badges.push(badgeLabels.perStay);
    if (discount.isPerNight) badges.push(badgeLabels.perNight);

    return (
        <div className="flex items-start justify-between border-b pb-3 last:border-0">
            <div>
                <p className="font-medium text-sm">{name}</p>
                {badges.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {badges.map((badge) => (
                            <Badge
                                key={badge}
                                variant="success"
                                className="text-xs"
                            >
                                {badge}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
            <p className="font-semibold text-green-600 text-sm dark:text-green-400">
                -
                {discount.isPercent && discount.price
                    ? `${discount.price}%`
                    : formatPrice(discount.price, discount.currency)}
            </p>
        </div>
    );
}

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
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id_/pricing')({
    component: AccommodationPricingPage
});

function AccommodationPricingPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: accommodation, isLoading } = useAccommodationQuery(id);

    const price = accommodation?.price;
    const basePrice = price?.price;
    const currency = price?.currency || 'ARS';
    const additionalFees = price?.additionalFees;
    const discounts = price?.discounts;

    const formatPrice = (amount?: number, curr?: string) => {
        if (amount === undefined) return 'N/A';
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: curr || currency
        }).format(amount);
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
                    <p className="text-muted-foreground">No pricing information available.</p>
                ) : (
                    <div className="space-y-6">
                        {/* Base Pricing */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Base Pricing</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-muted-foreground text-sm">
                                            Price per Night
                                        </p>
                                        <p className="font-semibold text-2xl">
                                            {formatPrice(basePrice, currency)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-sm">Currency</p>
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
                                    <CardTitle className="text-lg">Additional Fees</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {additionalFees?.cleaning && (
                                            <FeeItem
                                                name="Cleaning Fee"
                                                fee={additionalFees.cleaning}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {additionalFees?.tax && (
                                            <FeeItem
                                                name="Tax"
                                                fee={additionalFees.tax}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {additionalFees?.lateCheckout && (
                                            <FeeItem
                                                name="Late Checkout"
                                                fee={additionalFees.lateCheckout}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {additionalFees?.pets && (
                                            <FeeItem
                                                name="Pet Fee"
                                                fee={additionalFees.pets}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {additionalFees?.parking && (
                                            <FeeItem
                                                name="Parking"
                                                fee={additionalFees.parking}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {additionalFees?.extraGuest && (
                                            <FeeItem
                                                name="Extra Guest"
                                                fee={additionalFees.extraGuest}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {additionalFees?.others?.map((other, index) => (
                                            <FeeItem
                                                // biome-ignore lint/suspicious/noArrayIndexKey: dynamic fee items may not have stable IDs
                                                key={index}
                                                name={other.name}
                                                fee={other}
                                                formatPrice={formatPrice}
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
                                    <CardTitle className="text-lg">Discounts</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {discounts?.weekly && (
                                            <DiscountItem
                                                name="Weekly Discount"
                                                discount={discounts.weekly}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {discounts?.monthly && (
                                            <DiscountItem
                                                name="Monthly Discount"
                                                discount={discounts.monthly}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {discounts?.lastMinute && (
                                            <DiscountItem
                                                name="Last Minute Discount"
                                                discount={discounts.lastMinute}
                                                formatPrice={formatPrice}
                                            />
                                        )}
                                        {discounts?.others?.map((other, index) => (
                                            <DiscountItem
                                                // biome-ignore lint/suspicious/noArrayIndexKey: dynamic discount items may not have stable IDs
                                                key={index}
                                                name={other.name}
                                                discount={other}
                                                formatPrice={formatPrice}
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

function FeeItem({
    name,
    fee,
    formatPrice
}: {
    name: string;
    fee: FeeData;
    formatPrice: (amount?: number, curr?: string) => string;
}) {
    const badges = [];
    if (fee.isIncluded) badges.push('Included');
    if (fee.isOptional) badges.push('Optional');
    if (fee.isPercent) badges.push('Percentage');
    if (fee.isPerStay) badges.push('Per Stay');
    if (fee.isPerNight) badges.push('Per Night');
    if (fee.isPerGuest) badges.push('Per Guest');

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
    formatPrice
}: {
    name: string;
    discount: FeeData;
    formatPrice: (amount?: number, curr?: string) => string;
}) {
    const badges = [];
    if (discount.isPercent) badges.push('Percentage');
    if (discount.isPerStay) badges.push('Per Stay');
    if (discount.isPerNight) badges.push('Per Night');

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
            <p className="font-semibold text-green-600 text-sm">
                -
                {discount.isPercent && discount.price
                    ? `${discount.price}%`
                    : formatPrice(discount.price, discount.currency)}
            </p>
        </div>
    );
}

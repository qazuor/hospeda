/**
 * Pricing page sub-components
 *
 * FeeItem and DiscountItem display components with their associated types,
 * used by the accommodation pricing tab.
 */
import { Badge } from '@/components/ui/badge';

export type FeeData = {
    price?: number;
    currency?: string;
    isIncluded?: boolean;
    isOptional?: boolean;
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
};

export type FeeBadgeLabels = {
    included: string;
    optional: string;
    percentage: string;
    perStay: string;
    perNight: string;
    perGuest: string;
};

export type DiscountBadgeLabels = {
    percentage: string;
    perStay: string;
    perNight: string;
};

export function FeeItem({
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

export function DiscountItem({
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

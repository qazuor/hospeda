import { useTranslations } from '@/hooks/use-translations';
import { defaultIntlLocale, formatNumber } from '@repo/i18n';
import type { PriceCurrencyEnum, PriceType } from '@repo/schemas';
import type { ReactNode } from 'react';

type PriceCellProps = {
    readonly value: unknown;
    readonly locale?: string;
};

/**
 * PriceCell component for rendering price values with currency formatting.
 * Expects a PriceType object with price and currency properties.
 * Handles various currency formats and provides fallbacks for missing data.
 */
export const PriceCell = ({ value, locale = defaultIntlLocale }: PriceCellProps): ReactNode => {
    const { t } = useTranslations();

    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">—</span>;
    }

    // Handle non-object values
    if (typeof value !== 'object') {
        return <span className="text-foreground">{String(value)}</span>;
    }

    const priceData = value as PriceType;

    // Handle missing price
    if (priceData.price === null || priceData.price === undefined) {
        return <span className="text-muted-foreground">{t('admin-common.states.noPrice')}</span>;
    }

    const price = Number(priceData.price);
    const currency = priceData.currency;

    // Handle invalid price numbers
    if (Number.isNaN(price)) {
        return (
            <span className="text-muted-foreground">{t('admin-common.states.invalidPrice')}</span>
        );
    }

    // Format the price based on currency
    const formattedPrice = formatPrice(price, currency, locale);

    return (
        <div className="flex items-center gap-1">
            <span className="font-medium text-foreground">{formattedPrice}</span>
            {currency && (
                <span className="text-muted-foreground text-xs uppercase">{currency}</span>
            )}
        </div>
    );
};

/**
 * Formats a price number based on the currency type and locale.
 *
 * @param price - Numeric price value
 * @param currency - Currency code (ARS, USD, etc.)
 * @param locale - BCP 47 locale string for formatting
 */
function formatPrice(
    price: number,
    currency: PriceCurrencyEnum | undefined,
    locale: string
): string {
    switch (currency) {
        case 'ARS':
            return formatNumber({
                value: price,
                locale,
                options: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }
            });

        case 'USD':
            return formatNumber({
                value: price,
                locale,
                options: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }
            });

        default:
            return formatNumber({
                value: price,
                locale,
                options: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }
            });
    }
}

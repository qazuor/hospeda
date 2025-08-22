import type { BasePriceType, PriceCurrencyEnum } from '@repo/types';
import type { ReactNode } from 'react';

type PriceCellProps = {
    readonly value: unknown;
};

/**
 * PriceCell component for rendering price values with currency formatting.
 * Expects a BasePriceType object with price and currency properties.
 * Handles various currency formats and provides fallbacks for missing data.
 */
export const PriceCell = ({ value }: PriceCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    // Handle non-object values
    if (typeof value !== 'object') {
        return <span className="text-gray-900 dark:text-gray-100">{String(value)}</span>;
    }

    const priceData = value as BasePriceType;

    // Handle missing price
    if (priceData.price === null || priceData.price === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">No price</span>;
    }

    const price = Number(priceData.price);
    const currency = priceData.currency;

    // Handle invalid price numbers
    if (Number.isNaN(price)) {
        return <span className="text-gray-400 dark:text-gray-500">Invalid price</span>;
    }

    // Format the price based on currency
    const formattedPrice = formatPrice(price, currency);

    return (
        <div className="flex items-center gap-1">
            <span className="font-medium text-gray-900 dark:text-gray-100">{formattedPrice}</span>
            {currency && (
                <span className="text-gray-500 text-xs uppercase dark:text-gray-400">
                    {currency}
                </span>
            )}
        </div>
    );
};

/**
 * Formats a price number based on the currency type.
 */
function formatPrice(price: number, currency?: PriceCurrencyEnum): string {
    switch (currency) {
        case 'ARS':
            // Argentine Peso formatting
            return new Intl.NumberFormat('es-AR', {
                style: 'decimal',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(price);

        case 'USD':
            // US Dollar formatting
            return new Intl.NumberFormat('en-US', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(price);

        default:
            // Default formatting for unknown currencies
            return new Intl.NumberFormat('en-US', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(price);
    }
}

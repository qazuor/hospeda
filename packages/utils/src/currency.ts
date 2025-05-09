/**
 * Currency utility functions
 * @module utils/currency
 */

/**
 * Format a number as currency
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'USD')
 * @param locale - Locale (default: 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
    }).format(amount);
}

/**
 * Convert an amount from one currency to another
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @param exchangeRates - Exchange rates object
 * @returns Converted amount
 */
export function convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRates: Record<string, number>
): number {
    if (fromCurrency === toCurrency) return amount;

    const fromRate = exchangeRates[fromCurrency];
    const toRate = exchangeRates[toCurrency];

    if (!fromRate || !toRate) {
        throw new Error(`Exchange rate not found for ${fromCurrency} or ${toCurrency}`);
    }

    return (amount / fromRate) * toRate;
}

/**
 * Calculate tax amount
 * @param amount - Base amount
 * @param taxRate - Tax rate (percentage)
 * @returns Tax amount
 */
export function calculateTax(amount: number, taxRate: number): number {
    return amount * (taxRate / 100);
}

/**
 * Calculate total amount with tax
 * @param amount - Base amount
 * @param taxRate - Tax rate (percentage)
 * @returns Total amount with tax
 */
export function calculateTotalWithTax(amount: number, taxRate: number): number {
    return amount + calculateTax(amount, taxRate);
}

/**
 * Calculate discount amount
 * @param amount - Base amount
 * @param discountRate - Discount rate (percentage)
 * @returns Discount amount
 */
export function calculateDiscount(amount: number, discountRate: number): number {
    return amount * (discountRate / 100);
}

/**
 * Calculate total amount with discount
 * @param amount - Base amount
 * @param discountRate - Discount rate (percentage)
 * @returns Total amount with discount
 */
export function calculateTotalWithDiscount(amount: number, discountRate: number): number {
    return amount - calculateDiscount(amount, discountRate);
}

/**
 * Parse a currency string to a number
 * @param currencyString - Currency string to parse
 * @returns Parsed number
 */
export function parseCurrency(currencyString: string): number {
    return Number.parseFloat(currencyString.replace(/[^\d.-]/g, ''));
}

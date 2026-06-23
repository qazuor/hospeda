/**
 * Currency utility functions
 * @module utils/currency
 */

// ---------------------------------------------------------------------------
// formatMicroUsd
// ---------------------------------------------------------------------------

/**
 * Converts an integer micro-USD amount to a human-readable USD display string.
 *
 * The unit is micro-USD (µUSD): 1 USD = 1,000,000 µUSD.  All cost values in
 * `ai_usage.costEstimateMicroUsd` are stored in this unit.
 *
 * **Precision strategy.** The dashboard must show sub-cent amounts faithfully
 * (e.g. `90000 µUSD = $0.09`, `184000 µUSD = $0.184`).  This function uses
 * up to 6 decimal places and strips trailing zeros so that:
 * - Whole cents display cleanly:   `90000  → "$0.09"`
 * - Sub-cent amounts are precise:  `184000 → "$0.184"`
 * - Zero displays simply:          `0      → "$0"`
 * - Large amounts stay readable:   `5000000 → "$5"`
 *
 * This is intentionally NOT `Intl.NumberFormat` — that rounds to 2 decimal
 * places and would misrepresent sub-cent AI costs.
 *
 * @param microUsd - Integer micro-USD amount (1 USD = 1,000,000 µUSD).
 *   Must be a finite number; non-finite values return `"$0"`.
 * @returns Formatted string such as `"$0.09"`, `"$0.184"`, or `"$5"`.
 *
 * @example
 * ```ts
 * formatMicroUsd(90000)    // "$0.09"
 * formatMicroUsd(184000)   // "$0.184"
 * formatMicroUsd(0)        // "$0"
 * formatMicroUsd(5000000)  // "$5"
 * formatMicroUsd(1234567)  // "$1.234567"
 * ```
 */
export function formatMicroUsd(microUsd: number): string {
    if (!Number.isFinite(microUsd)) {
        return '$0';
    }

    const usd = microUsd / 1_000_000;

    // Format to 6 decimal places (maximum precision for µUSD → USD).
    // Then strip trailing zeros and a lone trailing decimal point.
    const raw = usd.toFixed(6);
    const stripped = raw.replace(/\.?0+$/, '');

    return `$${stripped}`;
}

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
    // Strip currency symbols, whitespace, and letters
    let cleaned = currencyString.replace(/[^\d.,-]/g, '');

    // Detect European format: comma as decimal separator (e.g., "1.234,56")
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
        // European format: dots are thousands separators, comma is decimal
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        // US format: commas are thousands separators, dot is decimal
        cleaned = cleaned.replace(/,/g, '');
    }

    return Number.parseFloat(cleaned);
}

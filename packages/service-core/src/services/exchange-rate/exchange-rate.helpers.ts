/**
 * Converts an amount from one currency to another using a given rate.
 *
 * @param input - Object containing amount and rate
 * @param input.amount - The amount to convert
 * @param input.rate - The exchange rate to apply
 * @returns The converted amount rounded to 2 decimal places
 *
 * @example
 * ```ts
 * convertAmount({ amount: 100, rate: 1500 }) // 150000
 * convertAmount({ amount: 100, rate: 0.0007 }) // 0.07
 * convertAmount({ amount: 0, rate: 1500 }) // 0
 * ```
 */
export function convertAmount(input: { amount: number; rate: number }): number {
    return Number((input.amount * input.rate).toFixed(2));
}

/**
 * Calculates the inverse rate with precision handling.
 * Handles division by zero safely.
 *
 * @param input - Object containing the rate
 * @param input.rate - The rate to invert
 * @returns The inverse rate with 10 decimal places precision
 *
 * @example
 * ```ts
 * calculateInverseRate({ rate: 1500 }) // 0.0006666667
 * calculateInverseRate({ rate: 1 }) // 1
 * ```
 *
 * @throws {Error} If rate is zero
 */
export function calculateInverseRate(input: { rate: number }): number {
    if (input.rate === 0) {
        throw new Error('Cannot calculate inverse of zero rate');
    }
    return Number((1 / input.rate).toFixed(10));
}

/**
 * Formats a converted amount for display with currency symbol.
 *
 * @param input - Object containing amount, currency, and optional locale
 * @param input.amount - The amount to format
 * @param input.currency - The currency code (ISO 4217)
 * @param input.locale - The locale for formatting (default: 'es')
 * @returns Formatted currency string
 *
 * @example
 * ```ts
 * formatConvertedAmount({ amount: 1500.50, currency: 'ARS' }) // "$1.500,50"
 * formatConvertedAmount({ amount: 99.99, currency: 'USD', locale: 'en-US' }) // "$99.99"
 * ```
 */
export function formatConvertedAmount(input: {
    amount: number;
    currency: string;
    locale?: string;
}): string {
    return new Intl.NumberFormat(input.locale ?? 'es', {
        style: 'currency',
        currency: input.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(input.amount);
}

/**
 * Checks if an exchange rate is stale (too old).
 *
 * @param input - Object containing fetched date and max age
 * @param input.fetchedAt - The date when the rate was fetched
 * @param input.maxAgeMinutes - Maximum age in minutes before rate is considered stale
 * @returns True if the rate is older than maxAgeMinutes
 *
 * @example
 * ```ts
 * isRateStale({ fetchedAt: new Date(), maxAgeMinutes: 60 }) // false
 * const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
 * isRateStale({ fetchedAt: twoHoursAgo, maxAgeMinutes: 60 }) // true
 * ```
 */
export function isRateStale(input: {
    fetchedAt: Date;
    maxAgeMinutes: number;
}): boolean {
    const ageMs = Date.now() - input.fetchedAt.getTime();
    const maxAgeMs = input.maxAgeMinutes * 60 * 1000;
    return ageMs > maxAgeMs;
}

/**
 * Gets display metadata for an exchange rate.
 *
 * @param input - Object containing rate details
 * @param input.rate - The exchange rate value
 * @param input.source - The source of the exchange rate
 * @param input.fetchedAt - When the rate was fetched
 * @returns Display information including formatted rate, source, staleness, and last update
 *
 * @example
 * ```ts
 * getRateDisplayInfo({
 *   rate: 1500.1234,
 *   source: 'dolarapi',
 *   fetchedAt: new Date(),
 * })
 * // {
 * //   formattedRate: '1500.1234',
 * //   source: 'dolarapi',
 * //   isStale: false,
 * //   lastUpdated: '2025-02-13T12:00:00.000Z'
 * // }
 * ```
 */
export function getRateDisplayInfo(input: {
    rate: number;
    source: string;
    fetchedAt: Date;
}): {
    formattedRate: string;
    source: string;
    isStale: boolean;
    lastUpdated: string;
} {
    return {
        formattedRate: input.rate.toFixed(4),
        source: input.source,
        isStale: isRateStale({ fetchedAt: input.fetchedAt, maxAgeMinutes: 60 }),
        lastUpdated: input.fetchedAt.toISOString()
    };
}

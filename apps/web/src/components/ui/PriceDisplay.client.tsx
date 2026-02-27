import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { getApiUrl } from '../../lib/env';

/**
 * Props for the PriceDisplay component
 */
export interface PriceDisplayProps {
    /**
     * Amount in Argentine Pesos (ARS)
     */
    readonly amountARS: number;

    /**
     * Locale for currency resolution.
     * es -> ARS, en -> USD, pt -> BRL
     */
    readonly locale?: 'es' | 'en' | 'pt';

    /**
     * User-selected currency (overrides locale-derived currency)
     */
    readonly userCurrency?: 'ARS' | 'USD' | 'BRL';

    /**
     * Whether to show disclaimer for non-ARS conversions
     */
    readonly showDisclaimer?: boolean;

    /**
     * Additional CSS classes to apply
     */
    readonly className?: string;
}

/**
 * Conversion rates map: ARS per 1 unit of each currency.
 * CONVERSION_RATES.USD = how many ARS equals 1 USD.
 */
type ConversionRates = Readonly<Record<'ARS' | 'USD' | 'BRL', number>>;

/**
 * Fallback hardcoded conversion rates used when the API is unavailable.
 * 1 USD = 1000 ARS, 1 BRL = 200 ARS.
 */
const FALLBACK_RATES: ConversionRates = {
    ARS: 1,
    USD: 1000,
    BRL: 200
} as const;

/** localStorage key for caching exchange rates */
const CACHE_KEY = 'hospeda_exchange_rates';

/** Cache duration in milliseconds (1 hour) */
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Cached exchange rates entry stored in localStorage.
 */
interface RatesCacheEntry {
    readonly rates: ConversionRates;
    readonly cachedAt: number;
}

/**
 * Read cached rates from localStorage.
 * Returns null if cache is missing, invalid, or expired.
 */
function readCachedRates(): ConversionRates | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;

        const entry = JSON.parse(raw) as RatesCacheEntry;
        const isExpired = Date.now() - entry.cachedAt > CACHE_TTL_MS;

        if (isExpired) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        return entry.rates;
    } catch {
        return null;
    }
}

/**
 * Write rates to localStorage cache with current timestamp.
 */
function writeCachedRates(rates: ConversionRates): void {
    try {
        const entry: RatesCacheEntry = { rates, cachedAt: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // localStorage may be unavailable (private browsing, storage quota exceeded).
        // Silently ignore - the component will still function with in-memory rates.
    }
}

/**
 * Shape of a single item returned by GET /api/v1/public/exchange-rates.
 */
interface ExchangeRateApiItem {
    readonly fromCurrency: string;
    readonly toCurrency: string;
    readonly rate: number;
    readonly inverseRate: number;
}

/**
 * Shape of the paginated API response for exchange rates.
 */
interface ExchangeRatesApiResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: readonly ExchangeRateApiItem[];
    };
}

/**
 * Fetch exchange rates from the public API endpoint.
 * Normalizes the response into the ConversionRates shape (ARS per 1 foreign unit).
 * Falls back to FALLBACK_RATES on any error.
 */
async function fetchExchangeRates(): Promise<ConversionRates> {
    const apiUrl = getApiUrl();
    const endpoint = `${apiUrl}/api/v1/public/exchange-rates?pageSize=50`;

    try {
        const response = await fetch(endpoint, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10_000)
        });

        if (!response.ok) {
            return FALLBACK_RATES;
        }

        const body = (await response.json()) as ExchangeRatesApiResponse;

        if (!body.success || !body.data?.items?.length) {
            return FALLBACK_RATES;
        }

        const rates: Record<'ARS' | 'USD' | 'BRL', number> = { ...FALLBACK_RATES };

        for (const item of body.data.items) {
            const { fromCurrency, toCurrency, rate, inverseRate } = item;

            // If fromCurrency=USD/BRL and toCurrency=ARS, rate = ARS per 1 USD/BRL.
            if (toCurrency === 'ARS' && (fromCurrency === 'USD' || fromCurrency === 'BRL')) {
                rates[fromCurrency as 'USD' | 'BRL'] = rate;
            }

            // If fromCurrency=ARS and toCurrency=USD/BRL, inverseRate = ARS per 1 USD/BRL.
            if (fromCurrency === 'ARS' && (toCurrency === 'USD' || toCurrency === 'BRL')) {
                rates[toCurrency as 'USD' | 'BRL'] = inverseRate;
            }
        }

        return rates;
    } catch {
        return FALLBACK_RATES;
    }
}

/**
 * Resolve exchange rates: check localStorage cache first, then fetch from API.
 * Writes fresh rates to cache after a successful API call.
 */
async function resolveExchangeRates(): Promise<ConversionRates> {
    const cached = readCachedRates();
    if (cached) return cached;

    const fresh = await fetchExchangeRates();
    writeCachedRates(fresh);
    return fresh;
}

/**
 * Locale to currency mapping
 */
const localeToCurrency: Readonly<Record<string, 'ARS' | 'USD' | 'BRL'>> = {
    es: 'ARS',
    en: 'USD',
    pt: 'BRL'
};

/**
 * Currency formatters
 */
const formatters: Readonly<Record<'ARS' | 'USD' | 'BRL', Intl.NumberFormat>> = {
    ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
};

/**
 * PriceDisplay component
 *
 * Displays a price in ARS with optional conversion to USD or BRL based on locale or user preference.
 * Shows a disclaimer for converted prices with the original ARS reference value.
 *
 * Features:
 * - Currency resolution from locale or user preference
 * - Live exchange rates fetched from API with localStorage cache (1 hour TTL)
 * - Fallback to hardcoded rates when API is unavailable
 * - Intl.NumberFormat for proper currency formatting
 * - Optional disclaimer for non-ARS currencies
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <PriceDisplay amountARS={15000} locale="es" />
 * <PriceDisplay amountARS={15000} userCurrency="USD" />
 * <PriceDisplay amountARS={15000} locale="pt" showDisclaimer={true} />
 * ```
 */
export function PriceDisplay({
    amountARS,
    locale = 'es',
    userCurrency,
    showDisclaimer = true,
    className = ''
}: PriceDisplayProps): JSX.Element {
    const [conversionRates, setConversionRates] = useState<ConversionRates>(FALLBACK_RATES);

    useEffect(() => {
        let cancelled = false;

        resolveExchangeRates().then((rates) => {
            if (!cancelled) {
                setConversionRates(rates);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    /**
     * Resolve currency from userCurrency or locale
     */
    const resolvedCurrency = userCurrency || localeToCurrency[locale] || 'ARS';

    /**
     * Convert ARS to target currency and format.
     * conversionRates[currency] = ARS per 1 unit of currency.
     * So: amount_in_currency = amountARS / conversionRates[currency]
     */
    const convertedAmount = amountARS / conversionRates[resolvedCurrency];
    const formattedPrice = formatters[resolvedCurrency].format(convertedAmount);

    /**
     * ARS reference value (for disclaimer)
     */
    const arsFormatter = formatters.ARS;
    const arsFormatted = arsFormatter.format(amountARS);

    /**
     * Determine if disclaimer should be shown
     */
    const shouldShowDisclaimer = showDisclaimer && resolvedCurrency !== 'ARS';

    return (
        <span className={`price-display ${className}`.trim()}>
            <span className="price-value">{formattedPrice}</span>
            {shouldShowDisclaimer && (
                <span className="price-disclaimer mt-1 block text-gray-500 text-xs">
                    Precio aproximado. Valor de referencia en ARS: {arsFormatted}
                </span>
            )}
        </span>
    );
}

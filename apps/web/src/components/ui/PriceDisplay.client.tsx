import type { JSX } from 'react';

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
 * Conversion rates (placeholders for actual exchange rate integration)
 * 1 USD = 1000 ARS
 * 1 BRL = 200 ARS
 */
const CONVERSION_RATES = {
    ARS: 1,
    USD: 1000,
    BRL: 200
} as const;

/**
 * Locale to currency mapping
 */
const localeToCurrency: Record<string, 'ARS' | 'USD' | 'BRL'> = {
    es: 'ARS',
    en: 'USD',
    pt: 'BRL'
};

/**
 * Currency formatters
 */
const formatters: Record<'ARS' | 'USD' | 'BRL', Intl.NumberFormat> = {
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
 * - Automatic conversion using placeholder exchange rates
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
    /**
     * Resolve currency from userCurrency or locale
     */
    const resolvedCurrency = userCurrency || localeToCurrency[locale] || 'ARS';

    /**
     * Convert ARS to target currency and format
     */
    const convertedAmount = amountARS / CONVERSION_RATES[resolvedCurrency];
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

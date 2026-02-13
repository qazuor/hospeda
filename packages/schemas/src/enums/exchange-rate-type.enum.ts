/**
 * Exchange Rate Type Enum
 * Defines the different types of exchange rates available.
 * Primarily used for Argentine peso (ARS) exchange rate variants.
 */
export enum ExchangeRateTypeEnum {
    /** Official government rate */
    OFICIAL = 'oficial',
    /** Informal/parallel market rate */
    BLUE = 'blue',
    /** Electronic payment market rate (Mercado Electronico de Pagos) */
    MEP = 'mep',
    /** Contado con liquidacion rate */
    CCL = 'ccl',
    /** Credit/debit card rate (includes taxes) */
    TARJETA = 'tarjeta',
    /** Standard international rate */
    STANDARD = 'standard'
}

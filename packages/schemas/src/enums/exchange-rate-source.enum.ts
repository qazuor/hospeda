/**
 * Exchange Rate Source Enum
 * Defines the data sources from which exchange rates are fetched.
 */
export enum ExchangeRateSourceEnum {
    /** DolarAPI.com - Argentine exchange rates */
    DOLARAPI = 'dolarapi',
    /** ExchangeRate-API.com - International exchange rates */
    EXCHANGERATE_API = 'exchangerate-api',
    /** Manually set by admin */
    MANUAL = 'manual'
}

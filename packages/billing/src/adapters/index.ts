/**
 * Payment adapter configurations for Hospeda
 *
 * Provides configured payment adapters for different payment providers
 */

export {
    createMercadoPagoAdapter,
    getDefaultCountry,
    getDefaultCurrency,
    type MercadoPagoAdapterConfig
} from './mercadopago.js';

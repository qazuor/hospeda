/**
 * Mercado Pago configuration and validation
 * @module payments/config/mercado-pago
 */

import { PriceCurrencyEnum } from '@repo/types';

/**
 * Mercado Pago environment type
 */
export type MercadoPagoEnvironment = 'sandbox' | 'production';

/**
 * Mercado Pago configuration interface
 */
export interface MercadoPagoConfig {
    /** Access token for Mercado Pago API */
    accessToken: string;
    /** Public key for client-side operations */
    publicKey: string;
    /** Environment (sandbox or production) */
    environment: MercadoPagoEnvironment;
    /** Default currency for transactions */
    defaultCurrency: PriceCurrencyEnum;
    /** Webhook secret for signature validation */
    webhookSecret?: string;
    /** Base URL for webhook notifications */
    webhookBaseUrl?: string;
}

/**
 * Validates Mercado Pago configuration
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
function validateMercadoPagoConfig(config: MercadoPagoConfig): void {
    if (!config.accessToken) {
        throw new Error('Mercado Pago access token is required');
    }

    if (!config.publicKey) {
        throw new Error('Mercado Pago public key is required');
    }

    if (!['sandbox', 'production'].includes(config.environment)) {
        throw new Error('Mercado Pago environment must be "sandbox" or "production"');
    }

    if (!Object.values(PriceCurrencyEnum).includes(config.defaultCurrency)) {
        throw new Error('Invalid default currency for Mercado Pago');
    }
}

/**
 * Creates Mercado Pago configuration from environment variables
 * @param overrides - Optional configuration overrides
 * @returns Validated Mercado Pago configuration
 */
export const createMercadoPagoConfig = (
    overrides: Partial<MercadoPagoConfig> = {}
): MercadoPagoConfig => {
    const mergedConfig: MercadoPagoConfig = {
        accessToken: process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN || '',
        publicKey: process.env.HOSPEDA_MERCADO_PAGO_PUBLIC_KEY || '',
        environment:
            (process.env.HOSPEDA_MERCADO_PAGO_ENVIRONMENT as MercadoPagoEnvironment) || 'sandbox',
        defaultCurrency:
            (process.env.HOSPEDA_DEFAULT_CURRENCY as PriceCurrencyEnum) || PriceCurrencyEnum.ARS,
        webhookSecret: process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET,
        webhookBaseUrl: process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_BASE_URL,
        ...overrides
    };

    validateMercadoPagoConfig(mergedConfig);
    return mergedConfig;
};

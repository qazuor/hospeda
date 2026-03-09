/**
 * MercadoPago payment adapter configuration for Hospeda
 *
 * Provides a factory function to create and configure the MercadoPago payment adapter
 * with environment-based settings.
 */

import {
    type QZPayMercadoPagoAdapter,
    type QZPayMercadoPagoConfig,
    createQZPayMercadoPagoAdapter
} from '@qazuor/qzpay-mercadopago';
import { getEnv, getEnvBoolean, getEnvNumber } from '@repo/config';
import { createLogger } from '@repo/logger';

const logger = createLogger('billing:mercadopago');
import { MERCADO_PAGO_DEFAULT_TIMEOUT_MS } from '../constants/billing.constants.js';

/**
 * Configuration options for creating the MercadoPago adapter
 */
export interface MercadoPagoAdapterConfig {
    /**
     * MercadoPago access token
     * Typically starts with 'APP_USR-' or 'TEST-', but some test credentials
     * may use 'APP_USR-' prefix even in sandbox mode.
     *
     * @remarks
     * If not provided, will be read from HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN environment variable
     */
    accessToken?: string;

    /**
     * Webhook secret for IPN signature verification
     *
     * @remarks
     * If not provided, will be read from HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET environment variable
     */
    webhookSecret?: string;

    /**
     * Enable sandbox/test mode
     *
     * @remarks
     * When true, uses MercadoPago sandbox environment
     * When false, uses production environment (requires APP_USR- token)
     * If not provided, will be read from HOSPEDA_MERCADO_PAGO_SANDBOX environment variable (default: true)
     */
    sandbox?: boolean;

    /**
     * Request timeout in milliseconds
     *
     * @remarks
     * If not provided, will be read from HOSPEDA_MERCADO_PAGO_TIMEOUT environment variable (default: 5000)
     *
     * @default 5000
     */
    timeout?: number;

    /**
     * Platform ID for marketplace tracking
     *
     * @remarks
     * If not provided, will be read from HOSPEDA_MERCADO_PAGO_PLATFORM_ID environment variable
     */
    platformId?: string;

    /**
     * Integrator ID for tracking
     *
     * @remarks
     * If not provided, will be read from HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID environment variable
     */
    integratorId?: string;

    /**
     * Retry configuration for transient errors
     *
     * @default { enabled: true, maxAttempts: 3, initialDelayMs: 1000 }
     */
    retry?: {
        enabled?: boolean;
        maxAttempts?: number;
        initialDelayMs?: number;
    };
}

/**
 * Default configuration for Hospeda's MercadoPago integration
 */
const DEFAULT_CONFIG = {
    currency: 'ARS',
    country: 'AR',
    timeout: MERCADO_PAGO_DEFAULT_TIMEOUT_MS,
    retry: {
        enabled: true,
        maxAttempts: 3,
        initialDelayMs: 1000
    }
} as const;

/**
 * Creates and configures a MercadoPago payment adapter for Hospeda
 *
 * @param config - Configuration options (optional, defaults to environment variables)
 * @returns Configured MercadoPago adapter instance
 *
 * @throws {Error} If required environment variables are missing
 * @throws {Error} If access token format is invalid
 * @throws {Error} If sandbox mode doesn't match access token type
 *
 * @example
 * ```typescript
 * // Using environment variables (recommended)
 * const adapter = createMercadoPagoAdapter();
 *
 * // With custom configuration
 * const adapter = createMercadoPagoAdapter({
 *   accessToken: 'TEST-1234567890',
 *   sandbox: true,
 *   timeout: 10000
 * });
 *
 * // Use with QZPayBilling
 * import { QZPayBilling } from '@qazuor/qzpay-core';
 *
 * const billing = new QZPayBilling({
 *   storage: drizzleAdapter,
 *   paymentAdapter: adapter
 * });
 * ```
 */
export function createMercadoPagoAdapter(
    config: MercadoPagoAdapterConfig = {}
): QZPayMercadoPagoAdapter {
    // Get configuration from environment variables with fallbacks
    const accessToken = config.accessToken ?? getEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN');
    const webhookSecret = config.webhookSecret ?? getEnv('HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET', '');
    const sandbox = config.sandbox ?? getEnvBoolean('HOSPEDA_MERCADO_PAGO_SANDBOX', true);
    const timeout =
        config.timeout ?? getEnvNumber('HOSPEDA_MERCADO_PAGO_TIMEOUT', DEFAULT_CONFIG.timeout);
    const platformId = config.platformId ?? getEnv('HOSPEDA_MERCADO_PAGO_PLATFORM_ID', '');
    const integratorId = config.integratorId ?? getEnv('HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID', '');

    // Validate access token is not empty
    if (!accessToken) {
        throw new Error(
            'MercadoPago access token is required. Set HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN environment variable.'
        );
    }

    // Validate access token format - both test and production tokens use APP_USR- prefix
    const isValidToken = accessToken.startsWith('APP_USR-') || accessToken.startsWith('TEST-');

    if (!isValidToken) {
        throw new Error(
            'Invalid MercadoPago access token format. Expected prefix "APP_USR-" or "TEST-".'
        );
    }

    // Validate webhook secret based on environment
    if (!sandbox && !webhookSecret) {
        throw new Error(
            'Webhook secret is required in production mode. Set HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET environment variable. ' +
                'Without it, attackers could forge payment webhooks and manipulate subscription states.'
        );
    }

    if (sandbox && !webhookSecret) {
        logger.warn(
            '[billing] MercadoPago webhook secret is not configured in sandbox mode. ' +
                'Webhook signature verification will be skipped. Set HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET for proper testing.'
        );
    }

    // Build adapter configuration
    const adapterConfig: QZPayMercadoPagoConfig = {
        accessToken,
        timeout,
        retry: {
            enabled: config.retry?.enabled ?? DEFAULT_CONFIG.retry.enabled,
            maxAttempts: config.retry?.maxAttempts ?? DEFAULT_CONFIG.retry.maxAttempts,
            initialDelayMs: config.retry?.initialDelayMs ?? DEFAULT_CONFIG.retry.initialDelayMs
        }
    };

    // Add optional configuration
    if (webhookSecret) {
        adapterConfig.webhookSecret = webhookSecret;
    }

    if (platformId) {
        adapterConfig.platformId = platformId;
    }

    if (integratorId) {
        adapterConfig.integratorId = integratorId;
    }

    // Create and return adapter
    return createQZPayMercadoPagoAdapter(adapterConfig);
}

/**
 * Get default currency for Hospeda (Argentina)
 */
export function getDefaultCurrency(): string {
    return DEFAULT_CONFIG.currency;
}

/**
 * Get default country for Hospeda (Argentina)
 */
export function getDefaultCountry(): string {
    return DEFAULT_CONFIG.country;
}

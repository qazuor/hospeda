/**
 * QZPay Billing Middleware Configuration
 *
 * Integrates QZPay billing system with the Hospeda API.
 * Provides billing context to all routes through Hono middleware.
 *
 * Features:
 * - Customer management
 * - Subscription lifecycle
 * - Invoice generation and payment
 * - Entitlement and usage tracking
 * - MercadoPago payment integration
 *
 * @module middlewares/billing
 */

import { type QZPayBilling, createQZPayBilling } from '@qazuor/qzpay-core';
import { createQZPayMiddleware } from '@qazuor/qzpay-hono';
import { createMercadoPagoAdapter } from '@repo/billing';
import { createBillingAdapter, getDb } from '@repo/db';
import type { MiddlewareHandler } from 'hono';
import { apiLogger } from '../utils/logger';

/**
 * Check if billing is properly configured
 *
 * @returns True if all required environment variables are set
 */
function isBillingConfigured(): boolean {
    const requiredEnvVars = ['MERCADO_PAGO_ACCESS_TOKEN', 'HOSPEDA_DATABASE_URL'];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
        apiLogger.warn(
            `Billing not configured. Missing environment variables: ${missingVars.join(', ')}`
        );
        return false;
    }

    return true;
}

/**
 * Lazy-initialized QZPay billing instance
 * Only created when billing is properly configured
 */
let billingInstance: QZPayBilling | null = null;

/**
 * Get or create the QZPay billing instance
 *
 * @returns QZPay billing instance or null if not configured
 */
function getBillingInstance(): QZPayBilling | null {
    // Return cached instance if available
    if (billingInstance) {
        return billingInstance;
    }

    // Check configuration
    if (!isBillingConfigured()) {
        return null;
    }

    try {
        // Get database instance
        const db = getDb();

        // Create storage adapter
        const storageAdapter = createBillingAdapter(db, {
            livemode: process.env.NODE_ENV === 'production'
        });

        // Create payment adapter
        const paymentAdapter = createMercadoPagoAdapter({
            sandbox: process.env.NODE_ENV !== 'production'
        });

        // Create billing instance
        billingInstance = createQZPayBilling({
            storage: storageAdapter,
            paymentAdapter,
            defaultCurrency: 'ARS',
            livemode: process.env.NODE_ENV === 'production'
        });

        apiLogger.info('✅ QZPay billing initialized successfully');

        return billingInstance;
    } catch (error) {
        apiLogger.error(
            'Failed to initialize billing:',
            error instanceof Error ? error.message : String(error)
        );
        return null;
    }
}

/**
 * QZPay billing middleware
 *
 * Attaches QZPay billing instance to the request context.
 * Routes can access it via `c.get('qzpay')`.
 *
 * If billing is not configured (missing env vars), this middleware
 * does nothing and billing routes will return 503 Service Unavailable.
 *
 * @example
 * ```typescript
 * import { billingMiddleware } from './middlewares/billing';
 *
 * // Apply globally
 * app.use('*', billingMiddleware);
 *
 * // Or to specific routes
 * app.use('/api/v1/billing/*', billingMiddleware);
 *
 * // Access in route handler
 * app.get('/customer/:id', async (c) => {
 *   const qzpay = c.get('qzpay');
 *   const customer = await qzpay.customers.get(c.req.param('id'));
 *   return c.json(customer);
 * });
 * ```
 */
export const billingMiddleware: MiddlewareHandler = async (c, next) => {
    const billing = getBillingInstance();

    if (!billing) {
        // Billing not configured - set a flag for routes to check
        c.set('billingEnabled', false);
        await next();
        return;
    }

    // Create and apply QZPay middleware
    const qzpayMiddleware = createQZPayMiddleware({ billing });
    await qzpayMiddleware(c, next);

    // Set flag for routes
    c.set('billingEnabled', true);
};

/**
 * Middleware to require billing to be enabled
 *
 * Returns 503 if billing is not configured.
 * Use this on billing-specific routes.
 *
 * @example
 * ```typescript
 * import { requireBilling } from './middlewares/billing';
 *
 * app.use('/api/v1/billing/*', requireBilling);
 * ```
 */
export const requireBilling: MiddlewareHandler = async (c, next) => {
    const billingEnabled = c.get('billingEnabled');

    if (!billingEnabled) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured. Please contact support.'
                }
            },
            503
        );
    }

    await next();
};

/**
 * Get the QZPay billing instance (for use outside middleware context)
 *
 * @returns QZPay billing instance or null if not configured
 *
 * @example
 * ```typescript
 * import { getQZPayBilling } from './middlewares/billing';
 *
 * const billing = getQZPayBilling();
 * if (billing) {
 *   await billing.customers.create({ email: 'test@example.com' });
 * }
 * ```
 */
export function getQZPayBilling(): QZPayBilling | null {
    return getBillingInstance();
}

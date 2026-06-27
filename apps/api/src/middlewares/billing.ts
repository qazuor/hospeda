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
import {
    createMercadoPagoAdapter,
    createStubMercadoPagoAdapter,
    isTestControlEnabled
} from '@repo/billing';
import { createBillingAdapter, getDb } from '@repo/db';
import type { MiddlewareHandler } from 'hono';
import { qzpayLogger } from '../lib/qzpay-logger';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Check if billing is properly configured
 *
 * @returns True if all required environment variables are set
 */
function isBillingConfigured(): boolean {
    const missing: string[] = [];

    // Under the test-control gate (SPEC-217) the payment adapter is the
    // in-memory stub, which needs no MercadoPago access token. Only the DB is
    // required so the storage adapter can write real billing rows. Outside the
    // gate, the real MercadoPago token is mandatory as before.
    if (!isTestControlEnabled() && !env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN) {
        missing.push('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN');
    }
    if (!env.HOSPEDA_DATABASE_URL) {
        missing.push('HOSPEDA_DATABASE_URL');
    }

    if (missing.length > 0) {
        apiLogger.warn(
            `Billing not configured. Missing environment variables: ${missing.join(', ')}`
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
 * Backoff guard for a FAILED initialization.
 *
 * Without this, a failed init (e.g. an invalid MercadoPago access token) would
 * be retried — and re-log its full stack trace — on every request and every
 * cron tick (subscription-poll fires once per minute), flooding the logs. When
 * init throws we suppress further attempts until this timestamp elapses, so the
 * error is logged at most once per {@link BILLING_INIT_RETRY_BACKOFF_MS} while
 * a genuinely transient failure can still recover. A process restart (the only
 * way to apply a corrected token via redeploy) resets this module state anyway.
 */
let billingInitRetryAfter = 0;

/** Minimum gap between init attempts after a failure. */
const BILLING_INIT_RETRY_BACKOFF_MS = 5 * 60_000;

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

    // A recent init attempt failed: skip re-trying (and re-logging the stack)
    // until the backoff window elapses.
    if (billingInitRetryAfter > Date.now()) {
        return null;
    }

    try {
        // Get database instance
        const db = getDb();

        // Single source of truth for billing mode: HOSPEDA_MERCADO_PAGO_SANDBOX.
        // If MP runs in sandbox, the storage and billing instance must run in
        // test mode too — mixing live records with sandbox charges is invalid.
        // NODE_ENV is intentionally NOT consulted here so staging/preview can
        // run prod NODE_ENV with sandbox credentials and vice versa.
        const sandbox = env.HOSPEDA_MERCADO_PAGO_SANDBOX;
        const livemode = !sandbox;

        // Create storage adapter
        const storageAdapter = createBillingAdapter(db, { livemode });

        // Create payment adapter.
        //
        // SPEC-217: when the test-control gate is enabled
        // (HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true, set only in CI/E2E), use a
        // deterministic in-memory stub instead of the real MercadoPago adapter.
        // The real adapter would reach the network on customers.create (the
        // accommodation-publish trial flow) and 503 against CI's dummy access
        // token. The stub returns synthetic provider ids with no network, so
        // the publish flow's startTrial succeeds and the storage adapter writes
        // a real `trialing` billing_subscriptions row. Fault injection is
        // unaffected: applyTestControl throws BEFORE the adapter is reached.
        //
        // Outside the gate the behavior is byte-for-byte unchanged: the real
        // MercadoPago adapter is built, with qzpayLogger routing all
        // provider-side logs (webhook signature verification, HMAC mismatch
        // diagnostics, IPN dispatch, event mapping) through the structured
        // apiLogger.
        const paymentAdapter = isTestControlEnabled()
            ? createStubMercadoPagoAdapter()
            : createMercadoPagoAdapter({ logger: qzpayLogger });

        // Create billing instance.
        // `providerSyncErrorStrategy: 'throw'` is set explicitly so that
        // QZPayProviderSyncError surfaces to our Hono error handler on every
        // environment (including sandbox/test), where it is mapped to the
        // correct ServiceErrorCode by billing-provider-error.ts (SPEC-149 T-002).
        // Without this, qzpay-core defaults to 'log' in non-livemode and silently
        // swallows provider errors — callers would receive a null/undefined result
        // instead of a typed ServiceError.
        billingInstance = createQZPayBilling({
            storage: storageAdapter,
            paymentAdapter,
            defaultCurrency: 'ARS',
            livemode,
            providerSyncErrorStrategy: 'throw'
        });

        apiLogger.info('✅ QZPay billing initialized successfully');

        // Clear any prior failure backoff now that init succeeded.
        billingInitRetryAfter = 0;

        return billingInstance;
    } catch (error) {
        // Suppress further attempts (and stack-trace spam) for the backoff window.
        billingInitRetryAfter = Date.now() + BILLING_INIT_RETRY_BACKOFF_MS;

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        apiLogger.error(
            `Failed to initialize billing: ${errorMessage} (suppressing retries for ${
                BILLING_INIT_RETRY_BACKOFF_MS / 60_000
            }m)`
        );
        if (errorStack) {
            apiLogger.error(`Billing init stack: ${errorStack}`);
        }
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
 * app.use('/api/v1/protected/billing/*', billingMiddleware);
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

    // Set billing flag BEFORE next() so downstream middlewares
    // (billingCustomer, entitlement, trial) can see it
    c.set('billingEnabled', true);

    // Set billing instance in context and continue
    c.set('qzpay', billing);
    await next();
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
 * app.use('/api/v1/protected/billing/*', requireBilling);
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

/**
 * TEST-ONLY: Clear the cached billing singleton so the next call to
 * {@link getQZPayBilling} reconstructs it (picking up freshly-mocked
 * dependencies). Required by SPEC-143 e2e tests that swap
 * `createMercadoPagoAdapter` via `vi.mock` AFTER another test has already
 * triggered initialization (which would cache the real adapter).
 *
 * Throws when invoked outside `NODE_ENV === 'test'` to prevent accidental
 * use in production deployments — the cached singleton is load-bearing
 * for connection-pool reuse and metric continuity, dropping it under live
 * traffic would create a thundering-herd reconnect.
 *
 * @throws Error when NODE_ENV is not 'test'
 */
export function resetBillingInstance(): void {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error(
            'resetBillingInstance is test-only and must not be called outside NODE_ENV=test'
        );
    }
    billingInstance = null;
    // Also clear the failure backoff so a failed init in one test cannot
    // suppress billing for the next (the 5-minute window would outlast the
    // whole suite). See billingInitRetryAfter.
    billingInitRetryAfter = 0;
}

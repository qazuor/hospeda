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

import {
    createQZPayBilling,
    type QZPayBilling,
    type QZPayPaymentAdapter
} from '@qazuor/qzpay-core';
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
 * Which QZPay facade {@link getQZPayBilling} should hand out.
 */
export interface GetQZPayBillingOptions {
    /**
     * Request the facade reserved for billing-customer creation and sync
     * (`providerSyncErrorStrategy: 'log'`), instead of the default strict one
     * (`'throw'`). See {@link getQZPayBilling} and HOS-596.
     *
     * @default false
     */
    readonly forCustomerSync?: boolean;
}

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
 * Lazy-initialized QZPay facade used ONLY for billing-customer creation/sync.
 *
 * Identical to {@link billingInstance} (same storage adapter, same payment
 * adapter, same livemode) except for `providerSyncErrorStrategy: 'log'`, which
 * is what keeps the local `billing_customers` row alive when MercadoPago
 * rejects the customer create (HOS-596). See {@link getBillingInstance} for the
 * full rationale.
 */
let billingCustomerSyncInstance: QZPayBilling | null = null;

/**
 * The MercadoPago payment adapter backing {@link billingInstance}, cached so
 * callers that need the raw adapter (not the {@link QZPayBilling} facade) can
 * reach it. The facade deliberately does not expose the `prices` slot
 * (`preapproval_plan` CRUD), which HOS-191 provisioning needs — this accessor
 * is how {@link getBillingPaymentAdapter} hands it out. Populated by
 * {@link getBillingInstance} using the exact same adapter instance, so livemode
 * / sandbox / test-control selection stays in one place.
 */
let billingPaymentAdapter: QZPayPaymentAdapter | null = null;

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

        // Cache the adapter so getBillingPaymentAdapter() can hand out the raw
        // `prices` slot (preapproval_plan CRUD) that the QZPayBilling facade does
        // not expose — HOS-191 MP-plan provisioning needs it.
        billingPaymentAdapter = paymentAdapter;

        // Create billing instance.
        // `providerSyncErrorStrategy: 'throw'` is set explicitly so that
        // QZPayProviderSyncError surfaces to our Hono error handler on every
        // environment (including sandbox/test), where it is mapped to the
        // correct ServiceErrorCode by billing-provider-error.ts (SPEC-149 T-002).
        // Without this, qzpay-core defaults to 'log' in non-livemode and silently
        // swallows provider errors — callers would receive a null/undefined result
        // instead of a typed ServiceError.
        const strictInstance = createQZPayBilling({
            storage: storageAdapter,
            paymentAdapter,
            defaultCurrency: 'ARS',
            livemode,
            providerSyncErrorStrategy: 'throw'
        });

        // HOS-596: a SECOND facade over the very same storage + payment adapter,
        // differing only in `providerSyncErrorStrategy: 'log'`, reserved for
        // billing-customer creation/sync.
        //
        // Why it has to exist: qzpay-core's `customers.create()` inserts the
        // local `billing_customers` row FIRST, then calls MercadoPago, and under
        // `'throw'` it UNDOES its own insert (`storage.customers.delete()`) before
        // rethrowing. That is how every affected production account ended up with
        // zero live billing rows ~470 ms after signup, and why checkout answered
        // "No billing account found" (400) even on a pure GET.
        //
        // A local customer row is not money: it is an identity record that costs
        // nothing to keep and that the provider link can be reconciled onto later.
        // Losing it, by contrast, locks the account out of every paid path. So the
        // customer leg tolerates a MercadoPago outage while everything that DOES
        // move money — subscriptions, checkout sessions, cancellations — keeps
        // using `billingInstance` and its `'throw'` strategy, so
        // QZPayProviderSyncError still reaches billing-provider-error.ts and is
        // still mapped to a typed ServiceError (SPEC-149 T-002).
        //
        // The failure is NOT silent under `'log'`: qzpay logs the provider error
        // through `qzpayLogger` (→ apiLogger) with the MercadoPago error message
        // and `QZPayErrorCode.PROVIDER_CREATE_CUSTOMER_FAILED`, and
        // BillingCustomerSyncService additionally warns when the returned customer
        // carries no provider id.
        const customerSyncInstance = createQZPayBilling({
            storage: storageAdapter,
            paymentAdapter,
            defaultCurrency: 'ARS',
            livemode,
            providerSyncErrorStrategy: 'log'
        });

        // Published together, only once BOTH exist. Assigning `billingInstance`
        // above would make the early `if (billingInstance) return` at the top of
        // this function a permanent trap if the second construction threw: the
        // strict facade would serve forever while the customer-sync one stayed
        // null, and a null facade is exactly the "no billing account" shape this
        // change exists to remove.
        billingInstance = strictInstance;
        billingCustomerSyncInstance = customerSyncInstance;

        apiLogger.info('✅ QZPay billing initialized successfully');

        // Clear any prior failure backoff now that init succeeded.
        billingInitRetryAfter = 0;

        return billingInstance;
    } catch (error) {
        // Suppress further attempts (and stack-trace spam) for the backoff window.
        billingInitRetryAfter = Date.now() + BILLING_INIT_RETRY_BACKOFF_MS;

        // Clear the payment adapter too: it may have been assigned before the
        // failing step (createQZPayBilling) threw. Otherwise getBillingPaymentAdapter()
        // would hand out a live adapter while the rest of billing is unavailable.
        billingPaymentAdapter = null;

        // Both facades are published together above, so neither can be set here
        // — this is belt-and-braces against a future edit that publishes them
        // separately again.
        billingInstance = null;
        billingCustomerSyncInstance = null;

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
 * Get the raw MercadoPago payment adapter backing the billing instance.
 *
 * Unlike the {@link QZPayBilling} facade returned by the middleware, this exposes
 * the adapter's `prices` slot (`preapproval_plan` create/archive/retrieve), which
 * HOS-191 MP-plan provisioning uses to project Hospeda commercial plans onto
 * MercadoPago `preapproval_plan` objects.
 *
 * Triggers lazy initialization if needed (shares the same cached instance and the
 * same livemode/sandbox/test-control selection as {@link getBillingInstance}), and
 * returns `null` when billing is not configured or init is in its failure backoff.
 *
 * @returns The MercadoPago payment adapter, or `null` when billing is unavailable.
 */
export function getBillingPaymentAdapter(): QZPayPaymentAdapter | null {
    // Ensure the adapter is built (and cached) before handing it out.
    getBillingInstance();
    return billingPaymentAdapter;
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
 * Called with no arguments it returns the STRICT facade
 * (`providerSyncErrorStrategy: 'throw'`), which is what every money-moving
 * operation must use so `QZPayProviderSyncError` still reaches the typed error
 * mapping (SPEC-149 T-002).
 *
 * Called with `{ forCustomerSync: true }` it returns the tolerant facade
 * reserved for billing-customer creation and sync (HOS-596). That is the ONLY
 * facade {@link BillingCustomerSyncService} may be constructed with — the strict
 * one makes qzpay-core roll the local `billing_customers` row back whenever
 * MercadoPago rejects the customer create, which is what left production
 * accounts with zero live billing rows.
 *
 * @param options - Which facade to hand out. Defaults to the strict one.
 * @returns QZPay billing instance or null if not configured
 *
 * @example
 * ```typescript
 * import { getQZPayBilling } from './middlewares/billing';
 *
 * // Money-moving work: strict, so provider errors surface as typed errors.
 * const billing = getQZPayBilling();
 *
 * // Customer identity work: tolerant, so the local row survives a MP outage.
 * const syncService = new BillingCustomerSyncService(
 *     getQZPayBilling({ forCustomerSync: true }),
 *     { throwOnError: false }
 * );
 * ```
 */
export function getQZPayBilling(options: GetQZPayBillingOptions = {}): QZPayBilling | null {
    // Both facades are built together, so this also primes the customer-sync one.
    const strict = getBillingInstance();

    return options.forCustomerSync === true ? billingCustomerSyncInstance : strict;
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
    // The customer-sync facade is built in the same block, so it has to be
    // dropped together with the strict one — otherwise a reset test would keep
    // reading a facade wired to the previous test's adapter.
    billingCustomerSyncInstance = null;
    // Clear the cached payment adapter too, so a test that resets billing and then
    // simulates "unconfigured" gets a null adapter from getBillingPaymentAdapter()
    // rather than the previous test's stale instance.
    billingPaymentAdapter = null;
    // Also clear the failure backoff so a failed init in one test cannot
    // suppress billing for the next (the 5-minute window would outlast the
    // whole suite). See billingInitRetryAfter.
    billingInitRetryAfter = 0;
}

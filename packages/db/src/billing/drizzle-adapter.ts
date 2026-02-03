/**
 * QZPay Drizzle Storage Adapter Configuration
 *
 * Factory function for creating a QZPay Drizzle storage adapter
 * that integrates with the Hospeda database connection.
 *
 * This adapter provides all billing functionality including:
 * - Customer management
 * - Subscription lifecycle
 * - Invoice generation
 * - Payment processing
 * - Entitlement and limit tracking
 * - Plan and price configuration
 * - Add-on management
 * - Promo code handling
 * - Vendor/marketplace support
 *
 * @module @repo/db/billing
 */

import type { QZPayStorageAdapter } from '@qazuor/qzpay-core';
import { type QZPayDrizzleStorageAdapter, createQZPayDrizzleAdapter } from '@qazuor/qzpay-drizzle';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schemas/index.ts';

/**
 * Configuration options for the QZPay storage adapter
 */
export interface QZPayAdapterConfig {
    /**
     * Whether the adapter is running in live mode (production)
     * vs test mode (sandbox/development).
     *
     * @default true
     */
    livemode?: boolean;
}

/**
 * Creates a QZPay storage adapter using the Hospeda database connection
 *
 * This factory function initializes a Drizzle-based storage adapter that
 * implements all QZPay storage operations. The adapter uses the same
 * database connection pool as the rest of the Hospeda application.
 *
 * **Important:** The database connection must be initialized via `initializeDb()`
 * before calling this function.
 *
 * @param db - Drizzle database instance (from getDb())
 * @param config - Configuration options for the adapter
 * @returns Configured QZPay storage adapter
 *
 * @example
 * ```typescript
 * import { initializeDb, getDb, createBillingAdapter } from '@repo/db';
 * import { Pool } from 'pg';
 *
 * // Initialize database connection
 * const pool = new Pool({
 *   connectionString: process.env.DATABASE_URL
 * });
 * initializeDb(pool);
 *
 * // Create billing adapter
 * const db = getDb();
 * const billingAdapter = createBillingAdapter(db, {
 *   livemode: process.env.NODE_ENV === 'production'
 * });
 *
 * // Use with QZPay core
 * import { QZPay } from '@qazuor/qzpay-core';
 *
 * const qzpay = new QZPay({
 *   storage: billingAdapter,
 *   config: {
 *     currency: 'ARS',
 *     locale: 'es-AR'
 *   }
 * });
 * ```
 *
 * @example Transaction Support
 * ```typescript
 * import { withTransaction, createBillingAdapter } from '@repo/db';
 *
 * await withTransaction(async (tx) => {
 *   // Create billing adapter with transaction
 *   const billingAdapter = createBillingAdapter(tx, { livemode: true });
 *
 *   // All billing operations will be part of this transaction
 *   const customer = await billingAdapter.customers.create({
 *     email: 'customer@example.com'
 *   });
 *
 *   const subscription = await billingAdapter.subscriptions.create({
 *     customerId: customer.id,
 *     planId: 'plan_xxx'
 *   });
 * });
 * ```
 */
export function createBillingAdapter(
    db: NodePgDatabase<typeof schema>,
    config: QZPayAdapterConfig = {}
): QZPayStorageAdapter {
    // Cast db to the type expected by qzpay-drizzle (PostgresJsDatabase)
    // This is safe because both NodePgDatabase and PostgresJsDatabase
    // share the same core Drizzle API surface
    const adapter = createQZPayDrizzleAdapter(
        db as unknown as Parameters<typeof createQZPayDrizzleAdapter>[0],
        {
            livemode: config.livemode ?? true
        }
    );

    return adapter as unknown as QZPayStorageAdapter;
}

/**
 * Type alias for the QZPay Drizzle storage adapter
 *
 * Exported for type checking and dependency injection scenarios
 */
export type { QZPayDrizzleStorageAdapter };

/**
 * Re-export QZPay storage adapter interface for convenience
 */
export type { QZPayStorageAdapter } from '@qazuor/qzpay-core';

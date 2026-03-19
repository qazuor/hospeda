/**
 * QZPay HTTP Storage Adapter for Admin Application
 *
 * Implements QZPayStorageAdapter interface by making HTTP requests to the API.
 * This adapter is specifically designed for the admin app which has a full React tree
 * (not islands like the web app).
 *
 * Key features:
 * - Uses Better Auth for authentication (session cookie automatically included)
 * - Communicates with API at /api/v1/protected/billing/* endpoints
 * - Full CRUD operations for all billing entities
 * - Type-safe with QZPay core types
 * - Delegates all HTTP logic to the centralized fetchApi client
 *
 * @module lib/billing-http-adapter
 */

import type { QZPayStorageAdapter } from '@qazuor/qzpay-core';

import { createCustomerStorage } from './customer-storage';
import {
    createInvoiceStorage,
    createPlanStorage,
    createPriceStorage,
    createPromoCodeStorage
} from './plan-price-promo-storage';
import {
    createPaymentMethodStorage,
    createPaymentStorage,
    createSubscriptionStorage
} from './subscription-payment-storage';
import {
    createAddOnStorage,
    createEntitlementStorage,
    createLimitStorage,
    createVendorStorage
} from './vendor-entitlement-limit-addon-storage';

export type { HttpAdapterConfig } from './billing-fetch';

import type { HttpAdapterConfig } from './billing-fetch';

/**
 * Creates an HTTP-based storage adapter for QZPay that delegates all requests
 * to the centralized `fetchApi` client.
 *
 * All billing operations are proxied through the API server which handles
 * database operations. Authentication is managed automatically via Better Auth
 * session cookies.
 *
 * @param _config - Configuration options (kept for backwards compatibility; fields are unused)
 * @returns QZPayStorageAdapter instance
 *
 * @example
 * ```ts
 * const adapter = createHttpBillingAdapter({
 *   apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
 * });
 * ```
 */
export function createHttpBillingAdapter(_config: HttpAdapterConfig): QZPayStorageAdapter {
    return {
        customers: createCustomerStorage(),
        subscriptions: createSubscriptionStorage(),
        payments: createPaymentStorage(),
        paymentMethods: createPaymentMethodStorage(),
        invoices: createInvoiceStorage(),
        plans: createPlanStorage(),
        prices: createPriceStorage(),
        promoCodes: createPromoCodeStorage(),
        vendors: createVendorStorage(),
        entitlements: createEntitlementStorage(),
        limits: createLimitStorage(),
        addons: createAddOnStorage(),

        /**
         * Transaction wrapper.
         *
         * The HTTP adapter does not support real client-side transactions.
         * This is a pass-through that executes the callback directly.
         * Actual transaction handling occurs on the API server.
         */
        transaction: async <T>(fn: () => Promise<T>): Promise<T> => {
            return fn();
        }
    };
}

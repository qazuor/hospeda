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

import type {
    QZPayAddOn,
    QZPayAddOnStorage,
    QZPayCreateAddOnInput,
    QZPayCreateCustomerInput,
    QZPayCreateInvoiceInput,
    QZPayCreatePaymentMethodInput,
    QZPayCreatePlanInput,
    QZPayCreatePriceInput,
    QZPayCreatePromoCodeInput,
    QZPayCreateSubscriptionInput,
    QZPayCreateVendorInput,
    QZPayCustomer,
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayCustomerStorage,
    QZPayEntitlement,
    QZPayEntitlementStorage,
    QZPayGrantEntitlementInput,
    QZPayIncrementLimitInput,
    QZPayInvoice,
    QZPayInvoiceStorage,
    QZPayLimit,
    QZPayLimitStorage,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPayPayment,
    QZPayPaymentMethod,
    QZPayPaymentMethodStorage,
    QZPayPaymentStorage,
    QZPayPlan,
    QZPayPlanStorage,
    QZPayPrice,
    QZPayPriceStorage,
    QZPayPromoCode,
    QZPayPromoCodeStorage,
    QZPaySetLimitInput,
    QZPayStorageAdapter,
    QZPaySubscription,
    QZPaySubscriptionAddOn,
    QZPaySubscriptionStorage,
    QZPayUpdateAddOnInput,
    QZPayUpdateCustomerInput,
    QZPayUpdatePaymentMethodInput,
    QZPayUpdateSubscriptionInput,
    QZPayUpdateVendorInput,
    QZPayUsageRecord,
    QZPayVendor,
    QZPayVendorPayout,
    QZPayVendorStorage
} from '@qazuor/qzpay-core';

import { fetchApi } from './api/client';

/**
 * Configuration options for the HTTP billing adapter.
 *
 * @remarks
 * The `apiUrl` field is kept for backwards compatibility but is no longer used
 * internally. The centralized `fetchApi` client resolves the base URL from the
 * `VITE_API_URL` environment variable automatically.
 *
 * The `getAuthToken` field is also unused. Better Auth handles authentication
 * via session cookies (`credentials: 'include'`) through the centralized client.
 */
export interface HttpAdapterConfig {
    /**
     * Base API URL (e.g., 'http://localhost:3001').
     *
     * @deprecated Not used internally. The centralized fetchApi client resolves
     * the base URL from the VITE_API_URL environment variable.
     */
    apiUrl: string;

    /**
     * Optional function to get an authentication token.
     *
     * @deprecated Not used internally. Better Auth manages authentication
     * automatically via session cookies included in every request.
     */
    getAuthToken?: () => Promise<string | null>;
}

/**
 * Makes a billing API request using the centralized fetchApi client and
 * unwraps the response body envelope (supports both `{ data: T }` and bare `T`).
 *
 * @param path - The billing endpoint path (e.g., '/api/v1/protected/billing/customers')
 * @param method - HTTP method
 * @param body - Optional request body
 * @returns The unwrapped response value typed as T
 */
async function billingFetch<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
): Promise<T> {
    const { data } = await fetchApi<{ data: T } | T>({ path, method, body });
    // Unwrap API envelope `{ data: T }` when present, otherwise return bare value
    if (data !== null && typeof data === 'object' && 'data' in (data as object)) {
        return (data as { data: T }).data;
    }
    return data as T;
}

/**
 * Create HTTP-based customer storage implementation
 */
function createCustomerStorage(): QZPayCustomerStorage {
    return {
        create: async (input: QZPayCreateCustomerInput) => {
            return billingFetch<QZPayCustomer>(
                '/api/v1/protected/billing/customers',
                'POST',
                input
            );
        },

        update: async (id: string, input: QZPayUpdateCustomerInput) => {
            return billingFetch<QZPayCustomer>(
                `/api/v1/protected/billing/customers/${id}`,
                'PUT',
                input
            );
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/customers/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayCustomer>(`/api/v1/protected/billing/customers/${id}`);
        },

        findByExternalId: async (externalId: string) => {
            const params = new URLSearchParams({ externalId });
            return billingFetch<QZPayCustomer>(
                `/api/v1/protected/billing/customers?${params.toString()}`
            );
        },

        findByEmail: async (email: string) => {
            const params = new URLSearchParams({ email });
            return billingFetch<QZPayCustomer>(
                `/api/v1/protected/billing/customers?${params.toString()}`
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayCustomer>>(
                `/api/v1/protected/billing/customers?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based subscription storage implementation
 */
function createSubscriptionStorage(): QZPaySubscriptionStorage {
    return {
        create: async (input: QZPayCreateSubscriptionInput & { id: string }) => {
            return billingFetch<QZPaySubscription>(
                '/api/v1/protected/billing/subscriptions',
                'POST',
                input
            );
        },

        update: async (id: string, input: QZPayUpdateSubscriptionInput) => {
            return billingFetch<QZPaySubscription>(
                `/api/v1/protected/billing/subscriptions/${id}`,
                'PUT',
                input
            );
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/subscriptions/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPaySubscription>(`/api/v1/protected/billing/subscriptions/${id}`);
        },

        findByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId });
            return billingFetch<QZPaySubscription[]>(
                `/api/v1/protected/billing/subscriptions?${params.toString()}`
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPaySubscription>>(
                `/api/v1/protected/billing/subscriptions?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based payment storage implementation
 */
function createPaymentStorage(): QZPayPaymentStorage {
    return {
        create: async (payment: QZPayPayment) => {
            return billingFetch<QZPayPayment>(
                '/api/v1/protected/billing/payments',
                'POST',
                payment
            );
        },

        update: async (id: string, payment: Partial<QZPayPayment>) => {
            return billingFetch<QZPayPayment>(
                `/api/v1/protected/billing/payments/${id}`,
                'PUT',
                payment
            );
        },

        findById: async (id: string) => {
            return billingFetch<QZPayPayment>(`/api/v1/protected/billing/payments/${id}`);
        },

        findByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId });
            return billingFetch<QZPayPayment[]>(
                `/api/v1/protected/billing/payments?${params.toString()}`
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayPayment>>(
                `/api/v1/protected/billing/payments?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based payment method storage implementation
 */
function createPaymentMethodStorage(): QZPayPaymentMethodStorage {
    return {
        create: async (input: QZPayCreatePaymentMethodInput & { id: string }) => {
            return billingFetch<QZPayPaymentMethod>(
                '/api/v1/protected/billing/payment-methods',
                'POST',
                input
            );
        },

        update: async (id: string, input: QZPayUpdatePaymentMethodInput) => {
            return billingFetch<QZPayPaymentMethod>(
                `/api/v1/protected/billing/payment-methods/${id}`,
                'PUT',
                input
            );
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/payment-methods/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayPaymentMethod>(
                `/api/v1/protected/billing/payment-methods/${id}`
            );
        },

        findByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId });
            return billingFetch<QZPayPaymentMethod[]>(
                `/api/v1/protected/billing/payment-methods?${params.toString()}`
            );
        },

        findDefaultByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId, isDefault: 'true' });
            return billingFetch<QZPayPaymentMethod>(
                `/api/v1/protected/billing/payment-methods?${params.toString()}`
            );
        },

        setDefault: async (customerId: string, paymentMethodId: string) => {
            await billingFetch(
                `/api/v1/protected/billing/payment-methods/${paymentMethodId}/set-default`,
                'POST',
                { customerId }
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayPaymentMethod>>(
                `/api/v1/protected/billing/payment-methods?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based invoice storage implementation
 */
function createInvoiceStorage(): QZPayInvoiceStorage {
    return {
        create: async (input: QZPayCreateInvoiceInput & { id: string }) => {
            return billingFetch<QZPayInvoice>('/api/v1/protected/billing/invoices', 'POST', input);
        },

        update: async (id: string, invoice: Partial<QZPayInvoice>) => {
            return billingFetch<QZPayInvoice>(
                `/api/v1/protected/billing/invoices/${id}`,
                'PUT',
                invoice
            );
        },

        findById: async (id: string) => {
            return billingFetch<QZPayInvoice>(`/api/v1/protected/billing/invoices/${id}`);
        },

        findByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId });
            return billingFetch<QZPayInvoice[]>(
                `/api/v1/protected/billing/invoices?${params.toString()}`
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayInvoice>>(
                `/api/v1/protected/billing/invoices?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based plan storage implementation
 */
function createPlanStorage(): QZPayPlanStorage {
    return {
        create: async (input: QZPayCreatePlanInput & { id: string }) => {
            return billingFetch<QZPayPlan>('/api/v1/protected/billing/plans', 'POST', input);
        },

        update: async (id: string, plan: Partial<QZPayPlan>) => {
            return billingFetch<QZPayPlan>(`/api/v1/protected/billing/plans/${id}`, 'PUT', plan);
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/plans/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayPlan>(`/api/v1/protected/billing/plans/${id}`);
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayPlan>>(
                `/api/v1/protected/billing/plans?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based price storage implementation
 */
function createPriceStorage(): QZPayPriceStorage {
    return {
        create: async (input: QZPayCreatePriceInput & { id: string }) => {
            return billingFetch<QZPayPrice>('/api/v1/protected/billing/prices', 'POST', input);
        },

        update: async (id: string, price: Partial<QZPayPrice>) => {
            return billingFetch<QZPayPrice>(`/api/v1/protected/billing/prices/${id}`, 'PUT', price);
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/prices/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayPrice>(`/api/v1/protected/billing/prices/${id}`);
        },

        findByPlanId: async (planId: string) => {
            const params = new URLSearchParams({ planId });
            return billingFetch<QZPayPrice[]>(
                `/api/v1/protected/billing/prices?${params.toString()}`
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayPrice>>(
                `/api/v1/protected/billing/prices?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based promo code storage implementation
 */
function createPromoCodeStorage(): QZPayPromoCodeStorage {
    return {
        create: async (input: QZPayCreatePromoCodeInput & { id: string }) => {
            return billingFetch<QZPayPromoCode>(
                '/api/v1/protected/billing/promo-codes',
                'POST',
                input
            );
        },

        update: async (id: string, promoCode: Partial<QZPayPromoCode>) => {
            return billingFetch<QZPayPromoCode>(
                `/api/v1/protected/billing/promo-codes/${id}`,
                'PUT',
                promoCode
            );
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/promo-codes/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayPromoCode>(`/api/v1/protected/billing/promo-codes/${id}`);
        },

        findByCode: async (code: string) => {
            return billingFetch<QZPayPromoCode>(
                `/api/v1/protected/billing/promo-codes/by-code/${code}`
            );
        },

        incrementRedemptions: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/promo-codes/${id}/redeem`, 'POST');
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayPromoCode>>(
                `/api/v1/protected/billing/promo-codes?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based vendor storage implementation
 */
function createVendorStorage(): QZPayVendorStorage {
    return {
        create: async (input: QZPayCreateVendorInput & { id: string }) => {
            return billingFetch<QZPayVendor>('/api/v1/protected/billing/vendors', 'POST', input);
        },

        update: async (id: string, input: QZPayUpdateVendorInput) => {
            return billingFetch<QZPayVendor>(
                `/api/v1/protected/billing/vendors/${id}`,
                'PUT',
                input
            );
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/vendors/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayVendor>(`/api/v1/protected/billing/vendors/${id}`);
        },

        findByExternalId: async (externalId: string) => {
            const params = new URLSearchParams({ externalId });
            return billingFetch<QZPayVendor>(
                `/api/v1/protected/billing/vendors?${params.toString()}`
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayVendor>>(
                `/api/v1/protected/billing/vendors?${params.toString()}`
            );
        },

        createPayout: async (payout: QZPayVendorPayout) => {
            return billingFetch<QZPayVendorPayout>(
                '/api/v1/protected/billing/vendor-payouts',
                'POST',
                payout
            );
        },

        findPayoutsByVendorId: async (vendorId: string) => {
            const params = new URLSearchParams({ vendorId });
            return billingFetch<QZPayVendorPayout[]>(
                `/api/v1/protected/billing/vendor-payouts?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based entitlement storage implementation
 */
function createEntitlementStorage(): QZPayEntitlementStorage {
    return {
        createDefinition: async (entitlement: QZPayEntitlement) => {
            return billingFetch<QZPayEntitlement>(
                '/api/v1/protected/billing/entitlements/definitions',
                'POST',
                entitlement
            );
        },

        findDefinitionByKey: async (key: string) => {
            return billingFetch<QZPayEntitlement>(
                `/api/v1/protected/billing/entitlements/definitions/${key}`
            );
        },

        listDefinitions: async () => {
            return billingFetch<QZPayEntitlement[]>(
                '/api/v1/protected/billing/entitlements/definitions'
            );
        },

        grant: async (input: QZPayGrantEntitlementInput) => {
            return billingFetch<QZPayCustomerEntitlement>(
                '/api/v1/protected/billing/entitlements/grant',
                'POST',
                input
            );
        },

        revoke: async (customerId: string, entitlementKey: string) => {
            await billingFetch(
                `/api/v1/protected/billing/entitlements/${customerId}/${entitlementKey}`,
                'DELETE'
            );
        },

        findByCustomerId: async (customerId: string) => {
            return billingFetch<QZPayCustomerEntitlement[]>(
                `/api/v1/protected/billing/entitlements/customer/${customerId}`
            );
        },

        check: async (customerId: string, entitlementKey: string) => {
            const result = await billingFetch<{ hasAccess: boolean }>(
                `/api/v1/protected/billing/entitlements/${customerId}/${entitlementKey}/check`
            );
            return result.hasAccess;
        }
    };
}

/**
 * Create HTTP-based limit storage implementation
 */
function createLimitStorage(): QZPayLimitStorage {
    return {
        createDefinition: async (limit: QZPayLimit) => {
            return billingFetch<QZPayLimit>(
                '/api/v1/protected/billing/limits/definitions',
                'POST',
                limit
            );
        },

        findDefinitionByKey: async (key: string) => {
            return billingFetch<QZPayLimit>(`/api/v1/protected/billing/limits/definitions/${key}`);
        },

        listDefinitions: async () => {
            return billingFetch<QZPayLimit[]>('/api/v1/protected/billing/limits/definitions');
        },

        set: async (input: QZPaySetLimitInput) => {
            return billingFetch<QZPayCustomerLimit>(
                '/api/v1/protected/billing/limits/set',
                'POST',
                input
            );
        },

        increment: async (input: QZPayIncrementLimitInput) => {
            return billingFetch<QZPayCustomerLimit>(
                '/api/v1/protected/billing/limits/increment',
                'POST',
                input
            );
        },

        findByCustomerId: async (customerId: string) => {
            return billingFetch<QZPayCustomerLimit[]>(
                `/api/v1/protected/billing/limits/customer/${customerId}`
            );
        },

        check: async (customerId: string, limitKey: string) => {
            return billingFetch<QZPayCustomerLimit>(
                `/api/v1/protected/billing/limits/${customerId}/${limitKey}/check`
            );
        },

        recordUsage: async (record: QZPayUsageRecord) => {
            return billingFetch<QZPayUsageRecord>(
                '/api/v1/protected/billing/usage',
                'POST',
                record
            );
        }
    };
}

/**
 * Create HTTP-based add-on storage implementation
 */
function createAddOnStorage(): QZPayAddOnStorage {
    return {
        create: async (input: QZPayCreateAddOnInput & { id: string }) => {
            return billingFetch<QZPayAddOn>('/api/v1/protected/billing/addons', 'POST', input);
        },

        update: async (id: string, input: QZPayUpdateAddOnInput) => {
            return billingFetch<QZPayAddOn>(`/api/v1/protected/billing/addons/${id}`, 'PUT', input);
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/protected/billing/addons/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayAddOn>(`/api/v1/protected/billing/addons/${id}`);
        },

        findByPlanId: async (planId: string) => {
            const params = new URLSearchParams({ planId });
            return billingFetch<QZPayAddOn[]>(
                `/api/v1/protected/billing/addons?${params.toString()}`
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayAddOn>>(
                `/api/v1/protected/billing/addons?${params.toString()}`
            );
        },

        addToSubscription: async (input: {
            id: string;
            subscriptionId: string;
            addOnId: string;
            quantity: number;
            unitAmount: number;
            currency: string;
            metadata?: Record<string, unknown>;
        }) => {
            return billingFetch<QZPaySubscriptionAddOn>(
                `/api/v1/protected/billing/subscriptions/${input.subscriptionId}/addons`,
                'POST',
                input
            );
        },

        removeFromSubscription: async (subscriptionId: string, addOnId: string) => {
            await billingFetch(
                `/api/v1/protected/billing/subscriptions/${subscriptionId}/addons/${addOnId}`,
                'DELETE'
            );
        },

        updateSubscriptionAddOn: async (
            subscriptionId: string,
            addOnId: string,
            input: Partial<QZPaySubscriptionAddOn>
        ) => {
            return billingFetch<QZPaySubscriptionAddOn>(
                `/api/v1/protected/billing/subscriptions/${subscriptionId}/addons/${addOnId}`,
                'PUT',
                input
            );
        },

        findBySubscriptionId: async (subscriptionId: string) => {
            return billingFetch<QZPaySubscriptionAddOn[]>(
                `/api/v1/protected/billing/subscriptions/${subscriptionId}/addons`
            );
        },

        findSubscriptionAddOn: async (
            subscriptionId: string,
            addOnId: string
        ): Promise<QZPaySubscriptionAddOn | null> => {
            try {
                return await billingFetch<QZPaySubscriptionAddOn>(
                    `/api/v1/protected/billing/subscriptions/${subscriptionId}/addons/${addOnId}`
                );
            } catch (error) {
                if (error instanceof Error && error.message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        }
    };
}

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

/**
 * QZPay HTTP Storage Adapter for Admin Application
 *
 * Implements QZPayStorageAdapter interface by making HTTP requests to the API.
 * This adapter is specifically designed for the admin app which has a full React tree
 * (not islands like the web app).
 *
 * Key features:
 * - Uses Clerk for authentication (auth token automatically included)
 * - Communicates with API at /api/v1/billing/* endpoints
 * - Full CRUD operations for all billing entities
 * - Type-safe with QZPay core types
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

/**
 * Configuration options for HTTP adapter
 */
export interface HttpAdapterConfig {
    /**
     * Base API URL (e.g., 'http://localhost:3001')
     */
    apiUrl: string;

    /**
     * Optional function to get authentication token
     * If not provided, assumes Clerk handles auth via cookies
     */
    getAuthToken?: () => Promise<string | null>;
}

/**
 * Helper to make HTTP requests to the API
 */
async function fetchAPI<T>(
    apiUrl: string,
    endpoint: string,
    options?: RequestInit,
    getAuthToken?: () => Promise<string | null>
): Promise<T> {
    const url = `${apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>)
    };

    // Add auth token if available
    if (getAuthToken) {
        const token = await getAuthToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Include cookies for Clerk auth
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({
            error: { message: response.statusText }
        }));
        throw new Error(error.error?.message || error.message || 'API request failed');
    }

    const result = await response.json();
    return result.data ?? result;
}

/**
 * Create HTTP-based customer storage implementation
 */
function createCustomerStorage(config: HttpAdapterConfig): QZPayCustomerStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreateCustomerInput) => {
            return fetchAPI<QZPayCustomer>(
                apiUrl,
                '/api/v1/billing/customers',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, input: QZPayUpdateCustomerInput) => {
            return fetchAPI<QZPayCustomer>(
                apiUrl,
                `/api/v1/billing/customers/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        delete: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/customers/${id}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayCustomer>(
                apiUrl,
                `/api/v1/billing/customers/${id}`,
                {},
                getAuthToken
            );
        },

        findByExternalId: async (externalId: string) => {
            const params = new URLSearchParams({ externalId });
            return fetchAPI<QZPayCustomer>(
                apiUrl,
                `/api/v1/billing/customers?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        findByEmail: async (email: string) => {
            const params = new URLSearchParams({ email });
            return fetchAPI<QZPayCustomer>(
                apiUrl,
                `/api/v1/billing/customers?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayCustomer>>(
                apiUrl,
                `/api/v1/billing/customers?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based subscription storage implementation
 */
function createSubscriptionStorage(config: HttpAdapterConfig): QZPaySubscriptionStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreateSubscriptionInput & { id: string }) => {
            return fetchAPI<QZPaySubscription>(
                apiUrl,
                '/api/v1/billing/subscriptions',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, input: QZPayUpdateSubscriptionInput) => {
            return fetchAPI<QZPaySubscription>(
                apiUrl,
                `/api/v1/billing/subscriptions/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        delete: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/subscriptions/${id}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPaySubscription>(
                apiUrl,
                `/api/v1/billing/subscriptions/${id}`,
                {},
                getAuthToken
            );
        },

        findByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId });
            return fetchAPI<QZPaySubscription[]>(
                apiUrl,
                `/api/v1/billing/subscriptions?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPaySubscription>>(
                apiUrl,
                `/api/v1/billing/subscriptions?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based payment storage implementation
 */
function createPaymentStorage(config: HttpAdapterConfig): QZPayPaymentStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (payment: QZPayPayment) => {
            return fetchAPI<QZPayPayment>(
                apiUrl,
                '/api/v1/billing/payments',
                {
                    method: 'POST',
                    body: JSON.stringify(payment)
                },
                getAuthToken
            );
        },

        update: async (id: string, payment: Partial<QZPayPayment>) => {
            return fetchAPI<QZPayPayment>(
                apiUrl,
                `/api/v1/billing/payments/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(payment)
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayPayment>(
                apiUrl,
                `/api/v1/billing/payments/${id}`,
                {},
                getAuthToken
            );
        },

        findByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId });
            return fetchAPI<QZPayPayment[]>(
                apiUrl,
                `/api/v1/billing/payments?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayPayment>>(
                apiUrl,
                `/api/v1/billing/payments?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based payment method storage implementation
 */
function createPaymentMethodStorage(config: HttpAdapterConfig): QZPayPaymentMethodStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreatePaymentMethodInput & { id: string }) => {
            return fetchAPI<QZPayPaymentMethod>(
                apiUrl,
                '/api/v1/billing/payment-methods',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, input: QZPayUpdatePaymentMethodInput) => {
            return fetchAPI<QZPayPaymentMethod>(
                apiUrl,
                `/api/v1/billing/payment-methods/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        delete: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/payment-methods/${id}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayPaymentMethod>(
                apiUrl,
                `/api/v1/billing/payment-methods/${id}`,
                {},
                getAuthToken
            );
        },

        findByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId });
            return fetchAPI<QZPayPaymentMethod[]>(
                apiUrl,
                `/api/v1/billing/payment-methods?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        findDefaultByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId, isDefault: 'true' });
            return fetchAPI<QZPayPaymentMethod>(
                apiUrl,
                `/api/v1/billing/payment-methods?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        setDefault: async (customerId: string, paymentMethodId: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/payment-methods/${paymentMethodId}/set-default`,
                {
                    method: 'POST',
                    body: JSON.stringify({ customerId })
                },
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayPaymentMethod>>(
                apiUrl,
                `/api/v1/billing/payment-methods?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based invoice storage implementation
 */
function createInvoiceStorage(config: HttpAdapterConfig): QZPayInvoiceStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreateInvoiceInput & { id: string }) => {
            return fetchAPI<QZPayInvoice>(
                apiUrl,
                '/api/v1/billing/invoices',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, invoice: Partial<QZPayInvoice>) => {
            return fetchAPI<QZPayInvoice>(
                apiUrl,
                `/api/v1/billing/invoices/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(invoice)
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayInvoice>(
                apiUrl,
                `/api/v1/billing/invoices/${id}`,
                {},
                getAuthToken
            );
        },

        findByCustomerId: async (customerId: string) => {
            const params = new URLSearchParams({ customerId });
            return fetchAPI<QZPayInvoice[]>(
                apiUrl,
                `/api/v1/billing/invoices?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayInvoice>>(
                apiUrl,
                `/api/v1/billing/invoices?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based plan storage implementation
 */
function createPlanStorage(config: HttpAdapterConfig): QZPayPlanStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreatePlanInput & { id: string }) => {
            return fetchAPI<QZPayPlan>(
                apiUrl,
                '/api/v1/billing/plans',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, plan: Partial<QZPayPlan>) => {
            return fetchAPI<QZPayPlan>(
                apiUrl,
                `/api/v1/billing/plans/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(plan)
                },
                getAuthToken
            );
        },

        delete: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/plans/${id}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayPlan>(apiUrl, `/api/v1/billing/plans/${id}`, {}, getAuthToken);
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayPlan>>(
                apiUrl,
                `/api/v1/billing/plans?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based price storage implementation
 */
function createPriceStorage(config: HttpAdapterConfig): QZPayPriceStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreatePriceInput & { id: string }) => {
            return fetchAPI<QZPayPrice>(
                apiUrl,
                '/api/v1/billing/prices',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, price: Partial<QZPayPrice>) => {
            return fetchAPI<QZPayPrice>(
                apiUrl,
                `/api/v1/billing/prices/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(price)
                },
                getAuthToken
            );
        },

        delete: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/prices/${id}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayPrice>(apiUrl, `/api/v1/billing/prices/${id}`, {}, getAuthToken);
        },

        findByPlanId: async (planId: string) => {
            const params = new URLSearchParams({ planId });
            return fetchAPI<QZPayPrice[]>(
                apiUrl,
                `/api/v1/billing/prices?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayPrice>>(
                apiUrl,
                `/api/v1/billing/prices?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based promo code storage implementation
 */
function createPromoCodeStorage(config: HttpAdapterConfig): QZPayPromoCodeStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreatePromoCodeInput & { id: string }) => {
            return fetchAPI<QZPayPromoCode>(
                apiUrl,
                '/api/v1/billing/promo-codes',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, promoCode: Partial<QZPayPromoCode>) => {
            return fetchAPI<QZPayPromoCode>(
                apiUrl,
                `/api/v1/billing/promo-codes/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(promoCode)
                },
                getAuthToken
            );
        },

        delete: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/promo-codes/${id}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayPromoCode>(
                apiUrl,
                `/api/v1/billing/promo-codes/${id}`,
                {},
                getAuthToken
            );
        },

        findByCode: async (code: string) => {
            return fetchAPI<QZPayPromoCode>(
                apiUrl,
                `/api/v1/billing/promo-codes/by-code/${code}`,
                {},
                getAuthToken
            );
        },

        incrementRedemptions: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/promo-codes/${id}/redeem`,
                {
                    method: 'POST'
                },
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayPromoCode>>(
                apiUrl,
                `/api/v1/billing/promo-codes?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based vendor storage implementation
 */
function createVendorStorage(config: HttpAdapterConfig): QZPayVendorStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreateVendorInput & { id: string }) => {
            return fetchAPI<QZPayVendor>(
                apiUrl,
                '/api/v1/billing/vendors',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, input: QZPayUpdateVendorInput) => {
            return fetchAPI<QZPayVendor>(
                apiUrl,
                `/api/v1/billing/vendors/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        delete: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/vendors/${id}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayVendor>(apiUrl, `/api/v1/billing/vendors/${id}`, {}, getAuthToken);
        },

        findByExternalId: async (externalId: string) => {
            const params = new URLSearchParams({ externalId });
            return fetchAPI<QZPayVendor>(
                apiUrl,
                `/api/v1/billing/vendors?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayVendor>>(
                apiUrl,
                `/api/v1/billing/vendors?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        createPayout: async (payout: QZPayVendorPayout) => {
            return fetchAPI<QZPayVendorPayout>(
                apiUrl,
                '/api/v1/billing/vendor-payouts',
                {
                    method: 'POST',
                    body: JSON.stringify(payout)
                },
                getAuthToken
            );
        },

        findPayoutsByVendorId: async (vendorId: string) => {
            const params = new URLSearchParams({ vendorId });
            return fetchAPI<QZPayVendorPayout[]>(
                apiUrl,
                `/api/v1/billing/vendor-payouts?${params.toString()}`,
                {},
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based entitlement storage implementation
 */
function createEntitlementStorage(config: HttpAdapterConfig): QZPayEntitlementStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        createDefinition: async (entitlement: QZPayEntitlement) => {
            return fetchAPI<QZPayEntitlement>(
                apiUrl,
                '/api/v1/billing/entitlements/definitions',
                {
                    method: 'POST',
                    body: JSON.stringify(entitlement)
                },
                getAuthToken
            );
        },

        findDefinitionByKey: async (key: string) => {
            return fetchAPI<QZPayEntitlement>(
                apiUrl,
                `/api/v1/billing/entitlements/definitions/${key}`,
                {},
                getAuthToken
            );
        },

        listDefinitions: async () => {
            return fetchAPI<QZPayEntitlement[]>(
                apiUrl,
                '/api/v1/billing/entitlements/definitions',
                {},
                getAuthToken
            );
        },

        grant: async (input: QZPayGrantEntitlementInput) => {
            return fetchAPI<QZPayCustomerEntitlement>(
                apiUrl,
                '/api/v1/billing/entitlements/grant',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        revoke: async (customerId: string, entitlementKey: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/entitlements/${customerId}/${entitlementKey}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findByCustomerId: async (customerId: string) => {
            return fetchAPI<QZPayCustomerEntitlement[]>(
                apiUrl,
                `/api/v1/billing/entitlements/customer/${customerId}`,
                {},
                getAuthToken
            );
        },

        check: async (customerId: string, entitlementKey: string) => {
            const result = await fetchAPI<{ hasAccess: boolean }>(
                apiUrl,
                `/api/v1/billing/entitlements/${customerId}/${entitlementKey}/check`,
                {},
                getAuthToken
            );
            return result.hasAccess;
        }
    };
}

/**
 * Create HTTP-based limit storage implementation
 */
function createLimitStorage(config: HttpAdapterConfig): QZPayLimitStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        createDefinition: async (limit: QZPayLimit) => {
            return fetchAPI<QZPayLimit>(
                apiUrl,
                '/api/v1/billing/limits/definitions',
                {
                    method: 'POST',
                    body: JSON.stringify(limit)
                },
                getAuthToken
            );
        },

        findDefinitionByKey: async (key: string) => {
            return fetchAPI<QZPayLimit>(
                apiUrl,
                `/api/v1/billing/limits/definitions/${key}`,
                {},
                getAuthToken
            );
        },

        listDefinitions: async () => {
            return fetchAPI<QZPayLimit[]>(
                apiUrl,
                '/api/v1/billing/limits/definitions',
                {},
                getAuthToken
            );
        },

        set: async (input: QZPaySetLimitInput) => {
            return fetchAPI<QZPayCustomerLimit>(
                apiUrl,
                '/api/v1/billing/limits/set',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        increment: async (input: QZPayIncrementLimitInput) => {
            return fetchAPI<QZPayCustomerLimit>(
                apiUrl,
                '/api/v1/billing/limits/increment',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        findByCustomerId: async (customerId: string) => {
            return fetchAPI<QZPayCustomerLimit[]>(
                apiUrl,
                `/api/v1/billing/limits/customer/${customerId}`,
                {},
                getAuthToken
            );
        },

        check: async (customerId: string, limitKey: string) => {
            return fetchAPI<QZPayCustomerLimit>(
                apiUrl,
                `/api/v1/billing/limits/${customerId}/${limitKey}/check`,
                {},
                getAuthToken
            );
        },

        recordUsage: async (record: QZPayUsageRecord) => {
            return fetchAPI<QZPayUsageRecord>(
                apiUrl,
                '/api/v1/billing/usage',
                {
                    method: 'POST',
                    body: JSON.stringify(record)
                },
                getAuthToken
            );
        }
    };
}

/**
 * Create HTTP-based add-on storage implementation
 */
function createAddOnStorage(config: HttpAdapterConfig): QZPayAddOnStorage {
    const { apiUrl, getAuthToken } = config;

    return {
        create: async (input: QZPayCreateAddOnInput & { id: string }) => {
            return fetchAPI<QZPayAddOn>(
                apiUrl,
                '/api/v1/billing/addons',
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        update: async (id: string, input: QZPayUpdateAddOnInput) => {
            return fetchAPI<QZPayAddOn>(
                apiUrl,
                `/api/v1/billing/addons/${id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        delete: async (id: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/addons/${id}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        findById: async (id: string) => {
            return fetchAPI<QZPayAddOn>(apiUrl, `/api/v1/billing/addons/${id}`, {}, getAuthToken);
        },

        findByPlanId: async (planId: string) => {
            const params = new URLSearchParams({ planId });
            return fetchAPI<QZPayAddOn[]>(
                apiUrl,
                `/api/v1/billing/addons?${params.toString()}`,
                {},
                getAuthToken
            );
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());

            return fetchAPI<QZPayPaginatedResult<QZPayAddOn>>(
                apiUrl,
                `/api/v1/billing/addons?${params.toString()}`,
                {},
                getAuthToken
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
            return fetchAPI<QZPaySubscriptionAddOn>(
                apiUrl,
                `/api/v1/billing/subscriptions/${input.subscriptionId}/addons`,
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        removeFromSubscription: async (subscriptionId: string, addOnId: string) => {
            await fetchAPI(
                apiUrl,
                `/api/v1/billing/subscriptions/${subscriptionId}/addons/${addOnId}`,
                {
                    method: 'DELETE'
                },
                getAuthToken
            );
        },

        updateSubscriptionAddOn: async (
            subscriptionId: string,
            addOnId: string,
            input: Partial<QZPaySubscriptionAddOn>
        ) => {
            return fetchAPI<QZPaySubscriptionAddOn>(
                apiUrl,
                `/api/v1/billing/subscriptions/${subscriptionId}/addons/${addOnId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(input)
                },
                getAuthToken
            );
        },

        findBySubscriptionId: async (subscriptionId: string) => {
            return fetchAPI<QZPaySubscriptionAddOn[]>(
                apiUrl,
                `/api/v1/billing/subscriptions/${subscriptionId}/addons`,
                {},
                getAuthToken
            );
        },

        findSubscriptionAddOn: async (
            subscriptionId: string,
            addOnId: string
        ): Promise<QZPaySubscriptionAddOn | null> => {
            try {
                return await fetchAPI<QZPaySubscriptionAddOn>(
                    apiUrl,
                    `/api/v1/billing/subscriptions/${subscriptionId}/addons/${addOnId}`,
                    {},
                    getAuthToken
                );
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        }
    };
}

/**
 * Create HTTP-based storage adapter for QZPay
 *
 * This adapter implements the QZPayStorageAdapter interface by making HTTP
 * requests to the API server. All billing operations are proxied through
 * the API which handles database operations.
 *
 * @param config - Configuration options
 * @returns QZPayStorageAdapter instance
 *
 * @example
 * ```ts
 * const adapter = createHttpBillingAdapter({
 *   apiUrl: 'http://localhost:3001',
 *   getAuthToken: async () => {
 *     const session = await clerk.session();
 *     return session?.getToken();
 *   }
 * });
 * ```
 */
export function createHttpBillingAdapter(config: HttpAdapterConfig): QZPayStorageAdapter {
    return {
        customers: createCustomerStorage(config),
        subscriptions: createSubscriptionStorage(config),
        payments: createPaymentStorage(config),
        paymentMethods: createPaymentMethodStorage(config),
        invoices: createInvoiceStorage(config),
        plans: createPlanStorage(config),
        prices: createPriceStorage(config),
        promoCodes: createPromoCodeStorage(config),
        vendors: createVendorStorage(config),
        entitlements: createEntitlementStorage(config),
        limits: createLimitStorage(config),
        addons: createAddOnStorage(config),

        /**
         * Transaction wrapper
         *
         * Note: HTTP adapter doesn't support real transactions.
         * This is a pass-through that executes the function.
         * Actual transaction handling happens on the API server.
         */
        transaction: async <T>(fn: () => Promise<T>): Promise<T> => {
            return fn();
        }
    };
}

/**
 * HTTP-based QZPay Storage Adapter for Hospeda Web
 *
 * Provides a fetch-based implementation of QZPayStorageAdapter that proxies
 * all billing operations to the Hospeda API. Used by the BillingIsland component
 * to enable client-side billing operations through the API.
 *
 * @module lib/billing-http-adapter
 */

import type {
    QZPayAddOn,
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
    QZPayEntitlement,
    QZPayGrantEntitlementInput,
    QZPayIncrementLimitInput,
    QZPayInvoice,
    QZPayLimit,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPayPayment,
    QZPayPaymentMethod,
    QZPayPlan,
    QZPayPrice,
    QZPayPromoCode,
    QZPaySetLimitInput,
    QZPayStorageAdapter,
    QZPaySubscription,
    QZPaySubscriptionAddOn,
    QZPayUpdateAddOnInput,
    QZPayUpdateCustomerInput,
    QZPayUpdatePaymentMethodInput,
    QZPayUpdateSubscriptionInput,
    QZPayUpdateVendorInput,
    QZPayUsageRecord,
    QZPayVendor,
    QZPayVendorPayout
} from '@qazuor/qzpay-core';

/**
 * HTTP adapter configuration
 */
export interface HttpBillingAdapterConfig {
    /**
     * Base URL for the API (e.g., 'http://localhost:3001' or '/api/v1')
     */
    apiUrl: string;

    /**
     * Optional function to get auth token for authenticated requests
     * If not provided, requests will be made without authentication
     */
    getAuthToken?: () => Promise<string | null>;
}

/**
 * HTTP error response structure
 */
interface ApiErrorResponse {
    error: {
        message: string;
        code?: string;
    };
}

/**
 * API success response structure
 */
interface ApiSuccessResponse<T> {
    data: T;
}

/**
 * Create a fetch-based HTTP billing storage adapter
 *
 * @param config - Adapter configuration
 * @returns QZPayStorageAdapter implementation
 *
 * @example
 * ```typescript
 * const adapter = createHttpBillingAdapter({
 *   apiUrl: '/api/v1',
 *   getAuthToken: async () => {
 *     const session = await clerk.session.getToken();
 *     return session;
 *   }
 * });
 * ```
 */
export function createHttpBillingAdapter(config: HttpBillingAdapterConfig): QZPayStorageAdapter {
    const { apiUrl, getAuthToken } = config;

    /**
     * Make an authenticated fetch request
     */
    async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // Merge existing headers
        if (options.headers) {
            const existingHeaders = new Headers(options.headers);
            existingHeaders.forEach((value, key) => {
                headers[key] = value;
            });
        }

        // Add auth token if available
        if (getAuthToken) {
            const token = await getAuthToken();
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
        }

        const url = `${apiUrl}/billing${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include'
        });

        // Handle 404 - return null for not found
        if (response.status === 404) {
            throw new Error('Resource not found');
        }

        // Handle other errors
        if (!response.ok) {
            const errorData = (await response.json()) as ApiErrorResponse;
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const result = (await response.json()) as ApiSuccessResponse<T>;
        return result.data;
    }

    /**
     * Build query string from list options
     */
    function buildQueryString(options?: QZPayListOptions): string {
        if (!options) return '';

        const params = new URLSearchParams();

        if (options.limit) params.append('limit', String(options.limit));
        if (options.offset) params.append('offset', String(options.offset));
        if (options.orderBy) params.append('orderBy', options.orderBy);
        if (options.orderDirection) params.append('orderDirection', options.orderDirection);

        const query = params.toString();
        return query ? `?${query}` : '';
    }

    // Customer storage implementation
    const customers = {
        async create(input: QZPayCreateCustomerInput): Promise<QZPayCustomer> {
            return fetchApi<QZPayCustomer>('/customers', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async update(id: string, input: QZPayUpdateCustomerInput): Promise<QZPayCustomer> {
            return fetchApi<QZPayCustomer>(`/customers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input)
            });
        },

        async delete(id: string): Promise<void> {
            await fetchApi<void>(`/customers/${id}`, {
                method: 'DELETE'
            });
        },

        async findById(id: string): Promise<QZPayCustomer | null> {
            try {
                return await fetchApi<QZPayCustomer>(`/customers/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByExternalId(externalId: string): Promise<QZPayCustomer | null> {
            try {
                return await fetchApi<QZPayCustomer>(`/customers/external/${externalId}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByEmail(email: string): Promise<QZPayCustomer | null> {
            try {
                return await fetchApi<QZPayCustomer>(`/customers/email/${email}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayCustomer>> {
            return fetchApi<QZPayPaginatedResult<QZPayCustomer>>(
                `/customers${buildQueryString(options)}`
            );
        }
    };

    // Subscription storage implementation
    const subscriptions = {
        async create(
            input: QZPayCreateSubscriptionInput & { id: string }
        ): Promise<QZPaySubscription> {
            return fetchApi<QZPaySubscription>('/subscriptions', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async update(id: string, input: QZPayUpdateSubscriptionInput): Promise<QZPaySubscription> {
            return fetchApi<QZPaySubscription>(`/subscriptions/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input)
            });
        },

        async delete(id: string): Promise<void> {
            await fetchApi<void>(`/subscriptions/${id}`, {
                method: 'DELETE'
            });
        },

        async findById(id: string): Promise<QZPaySubscription | null> {
            try {
                return await fetchApi<QZPaySubscription>(`/subscriptions/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByCustomerId(customerId: string): Promise<QZPaySubscription[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPaySubscription>>(
                `/subscriptions?customerId=${customerId}`
            );
            return result.data;
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPaySubscription>> {
            return fetchApi<QZPayPaginatedResult<QZPaySubscription>>(
                `/subscriptions${buildQueryString(options)}`
            );
        }
    };

    // Payment storage implementation
    const payments = {
        async create(payment: QZPayPayment): Promise<QZPayPayment> {
            return fetchApi<QZPayPayment>('/payments', {
                method: 'POST',
                body: JSON.stringify(payment)
            });
        },

        async update(id: string, payment: Partial<QZPayPayment>): Promise<QZPayPayment> {
            return fetchApi<QZPayPayment>(`/payments/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payment)
            });
        },

        async findById(id: string): Promise<QZPayPayment | null> {
            try {
                return await fetchApi<QZPayPayment>(`/payments/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByCustomerId(customerId: string): Promise<QZPayPayment[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayPayment>>(
                `/payments?customerId=${customerId}`
            );
            return result.data;
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPayment>> {
            return fetchApi<QZPayPaginatedResult<QZPayPayment>>(
                `/payments${buildQueryString(options)}`
            );
        }
    };

    // Plan storage implementation
    const plans = {
        async create(input: QZPayCreatePlanInput & { id: string }): Promise<QZPayPlan> {
            return fetchApi<QZPayPlan>('/plans', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async update(id: string, plan: Partial<QZPayPlan>): Promise<QZPayPlan> {
            return fetchApi<QZPayPlan>(`/plans/${id}`, {
                method: 'PUT',
                body: JSON.stringify(plan)
            });
        },

        async delete(id: string): Promise<void> {
            await fetchApi<void>(`/plans/${id}`, {
                method: 'DELETE'
            });
        },

        async findById(id: string): Promise<QZPayPlan | null> {
            try {
                return await fetchApi<QZPayPlan>(`/plans/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPlan>> {
            return fetchApi<QZPayPaginatedResult<QZPayPlan>>(`/plans${buildQueryString(options)}`);
        }
    };

    // Price storage implementation
    const prices = {
        async create(input: QZPayCreatePriceInput & { id: string }): Promise<QZPayPrice> {
            return fetchApi<QZPayPrice>('/prices', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async update(id: string, price: Partial<QZPayPrice>): Promise<QZPayPrice> {
            return fetchApi<QZPayPrice>(`/prices/${id}`, {
                method: 'PUT',
                body: JSON.stringify(price)
            });
        },

        async delete(id: string): Promise<void> {
            await fetchApi<void>(`/prices/${id}`, {
                method: 'DELETE'
            });
        },

        async findById(id: string): Promise<QZPayPrice | null> {
            try {
                return await fetchApi<QZPayPrice>(`/prices/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByPlanId(planId: string): Promise<QZPayPrice[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayPrice>>(
                `/prices?planId=${planId}`
            );
            return result.data;
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPrice>> {
            return fetchApi<QZPayPaginatedResult<QZPayPrice>>(
                `/prices${buildQueryString(options)}`
            );
        }
    };

    // Invoice storage implementation
    const invoices = {
        async create(input: QZPayCreateInvoiceInput & { id: string }): Promise<QZPayInvoice> {
            return fetchApi<QZPayInvoice>('/invoices', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async update(id: string, invoice: Partial<QZPayInvoice>): Promise<QZPayInvoice> {
            return fetchApi<QZPayInvoice>(`/invoices/${id}`, {
                method: 'PUT',
                body: JSON.stringify(invoice)
            });
        },

        async findById(id: string): Promise<QZPayInvoice | null> {
            try {
                return await fetchApi<QZPayInvoice>(`/invoices/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByCustomerId(customerId: string): Promise<QZPayInvoice[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayInvoice>>(
                `/invoices?customerId=${customerId}`
            );
            return result.data;
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayInvoice>> {
            return fetchApi<QZPayPaginatedResult<QZPayInvoice>>(
                `/invoices${buildQueryString(options)}`
            );
        }
    };

    // Promo code storage implementation
    const promoCodes = {
        async create(input: QZPayCreatePromoCodeInput & { id: string }): Promise<QZPayPromoCode> {
            return fetchApi<QZPayPromoCode>('/promo-codes', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async update(id: string, promoCode: Partial<QZPayPromoCode>): Promise<QZPayPromoCode> {
            return fetchApi<QZPayPromoCode>(`/promo-codes/${id}`, {
                method: 'PUT',
                body: JSON.stringify(promoCode)
            });
        },

        async delete(id: string): Promise<void> {
            await fetchApi<void>(`/promo-codes/${id}`, {
                method: 'DELETE'
            });
        },

        async findById(id: string): Promise<QZPayPromoCode | null> {
            try {
                return await fetchApi<QZPayPromoCode>(`/promo-codes/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByCode(code: string): Promise<QZPayPromoCode | null> {
            try {
                return await fetchApi<QZPayPromoCode>(`/promo-codes/code/${code}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async incrementRedemptions(id: string): Promise<void> {
            await fetchApi<void>(`/promo-codes/${id}/redeem`, {
                method: 'POST'
            });
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPromoCode>> {
            return fetchApi<QZPayPaginatedResult<QZPayPromoCode>>(
                `/promo-codes${buildQueryString(options)}`
            );
        }
    };

    // Payment method storage implementation
    const paymentMethods = {
        async create(
            input: QZPayCreatePaymentMethodInput & { id: string }
        ): Promise<QZPayPaymentMethod> {
            return fetchApi<QZPayPaymentMethod>('/payment-methods', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async update(
            id: string,
            input: QZPayUpdatePaymentMethodInput
        ): Promise<QZPayPaymentMethod> {
            return fetchApi<QZPayPaymentMethod>(`/payment-methods/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input)
            });
        },

        async delete(id: string): Promise<void> {
            await fetchApi<void>(`/payment-methods/${id}`, {
                method: 'DELETE'
            });
        },

        async findById(id: string): Promise<QZPayPaymentMethod | null> {
            try {
                return await fetchApi<QZPayPaymentMethod>(`/payment-methods/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByCustomerId(customerId: string): Promise<QZPayPaymentMethod[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayPaymentMethod>>(
                `/payment-methods?customerId=${customerId}`
            );
            return result.data;
        },

        async findDefaultByCustomerId(customerId: string): Promise<QZPayPaymentMethod | null> {
            try {
                return await fetchApi<QZPayPaymentMethod>(`/payment-methods/default/${customerId}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async setDefault(customerId: string, paymentMethodId: string): Promise<void> {
            await fetchApi<void>(`/payment-methods/${paymentMethodId}/set-default`, {
                method: 'POST',
                body: JSON.stringify({ customerId })
            });
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayPaymentMethod>> {
            return fetchApi<QZPayPaginatedResult<QZPayPaymentMethod>>(
                `/payment-methods${buildQueryString(options)}`
            );
        }
    };

    // Vendor storage implementation (stub - not typically used on client)
    const vendors = {
        async create(_input: QZPayCreateVendorInput & { id: string }): Promise<QZPayVendor> {
            throw new Error('Vendor creation not supported on client');
        },

        async update(_id: string, _input: QZPayUpdateVendorInput): Promise<QZPayVendor> {
            throw new Error('Vendor update not supported on client');
        },

        async delete(_id: string): Promise<void> {
            throw new Error('Vendor deletion not supported on client');
        },

        async findById(id: string): Promise<QZPayVendor | null> {
            try {
                return await fetchApi<QZPayVendor>(`/vendors/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByExternalId(externalId: string): Promise<QZPayVendor | null> {
            try {
                return await fetchApi<QZPayVendor>(`/vendors/external/${externalId}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayVendor>> {
            return fetchApi<QZPayPaginatedResult<QZPayVendor>>(
                `/vendors${buildQueryString(options)}`
            );
        },

        async createPayout(_payout: QZPayVendorPayout): Promise<QZPayVendorPayout> {
            throw new Error('Vendor payout not supported on client');
        },

        async findPayoutsByVendorId(vendorId: string): Promise<QZPayVendorPayout[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayVendorPayout>>(
                `/vendors/${vendorId}/payouts`
            );
            return result.data;
        }
    };

    // Entitlement storage implementation
    const entitlements = {
        async createDefinition(_entitlement: QZPayEntitlement): Promise<QZPayEntitlement> {
            throw new Error('Entitlement definition creation not supported on client');
        },

        async findDefinitionByKey(key: string): Promise<QZPayEntitlement | null> {
            try {
                return await fetchApi<QZPayEntitlement>(`/entitlements/definitions/${key}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async listDefinitions(): Promise<QZPayEntitlement[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayEntitlement>>(
                '/entitlements/definitions'
            );
            return result.data;
        },

        async grant(input: QZPayGrantEntitlementInput): Promise<QZPayCustomerEntitlement> {
            return fetchApi<QZPayCustomerEntitlement>('/entitlements/grant', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async revoke(customerId: string, entitlementKey: string): Promise<void> {
            await fetchApi<void>(`/entitlements/revoke/${customerId}/${entitlementKey}`, {
                method: 'DELETE'
            });
        },

        async findByCustomerId(customerId: string): Promise<QZPayCustomerEntitlement[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayCustomerEntitlement>>(
                `/entitlements?customerId=${customerId}`
            );
            return result.data;
        },

        async check(customerId: string, entitlementKey: string): Promise<boolean> {
            try {
                const result = await fetchApi<{ hasAccess: boolean }>(
                    `/entitlements/check/${customerId}/${entitlementKey}`
                );
                return result.hasAccess;
            } catch {
                return false;
            }
        }
    };

    // Limit storage implementation
    const limits = {
        async createDefinition(_limit: QZPayLimit): Promise<QZPayLimit> {
            throw new Error('Limit definition creation not supported on client');
        },

        async findDefinitionByKey(key: string): Promise<QZPayLimit | null> {
            try {
                return await fetchApi<QZPayLimit>(`/limits/definitions/${key}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async listDefinitions(): Promise<QZPayLimit[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayLimit>>('/limits/definitions');
            return result.data;
        },

        async set(input: QZPaySetLimitInput): Promise<QZPayCustomerLimit> {
            return fetchApi<QZPayCustomerLimit>('/limits/set', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async increment(input: QZPayIncrementLimitInput): Promise<QZPayCustomerLimit> {
            return fetchApi<QZPayCustomerLimit>('/limits/increment', {
                method: 'POST',
                body: JSON.stringify(input)
            });
        },

        async findByCustomerId(customerId: string): Promise<QZPayCustomerLimit[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayCustomerLimit>>(
                `/limits?customerId=${customerId}`
            );
            return result.data;
        },

        async check(customerId: string, limitKey: string): Promise<QZPayCustomerLimit | null> {
            try {
                return await fetchApi<QZPayCustomerLimit>(
                    `/limits/check/${customerId}/${limitKey}`
                );
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async recordUsage(record: QZPayUsageRecord): Promise<QZPayUsageRecord> {
            return fetchApi<QZPayUsageRecord>('/limits/usage', {
                method: 'POST',
                body: JSON.stringify(record)
            });
        }
    };

    // Add-on storage implementation
    const addons = {
        async create(_input: QZPayCreateAddOnInput & { id: string }): Promise<QZPayAddOn> {
            throw new Error('Add-on creation not supported on client');
        },

        async update(_id: string, _input: QZPayUpdateAddOnInput): Promise<QZPayAddOn> {
            throw new Error('Add-on update not supported on client');
        },

        async delete(_id: string): Promise<void> {
            throw new Error('Add-on deletion not supported on client');
        },

        async findById(id: string): Promise<QZPayAddOn | null> {
            try {
                return await fetchApi<QZPayAddOn>(`/addons/${id}`);
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        },

        async findByPlanId(planId: string): Promise<QZPayAddOn[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPayAddOn>>(
                `/addons?planId=${planId}`
            );
            return result.data;
        },

        async list(options?: QZPayListOptions): Promise<QZPayPaginatedResult<QZPayAddOn>> {
            return fetchApi<QZPayPaginatedResult<QZPayAddOn>>(
                `/addons${buildQueryString(options)}`
            );
        },

        async addToSubscription(input: {
            id: string;
            subscriptionId: string;
            addOnId: string;
            quantity?: number;
        }): Promise<QZPaySubscriptionAddOn> {
            return fetchApi<QZPaySubscriptionAddOn>(
                `/subscriptions/${input.subscriptionId}/addons`,
                {
                    method: 'POST',
                    body: JSON.stringify(input)
                }
            );
        },

        async removeFromSubscription(subscriptionId: string, addOnId: string): Promise<void> {
            await fetchApi<void>(`/subscriptions/${subscriptionId}/addons/${addOnId}`, {
                method: 'DELETE'
            });
        },

        async updateSubscriptionAddOn(
            subscriptionId: string,
            addOnId: string,
            input: Partial<QZPaySubscriptionAddOn>
        ): Promise<QZPaySubscriptionAddOn> {
            return fetchApi<QZPaySubscriptionAddOn>(
                `/subscriptions/${subscriptionId}/addons/${addOnId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(input)
                }
            );
        },

        async findBySubscriptionId(subscriptionId: string): Promise<QZPaySubscriptionAddOn[]> {
            const result = await fetchApi<QZPayPaginatedResult<QZPaySubscriptionAddOn>>(
                `/subscriptions/${subscriptionId}/addons`
            );
            return result.data;
        },

        async findSubscriptionAddOn(
            subscriptionId: string,
            addOnId: string
        ): Promise<QZPaySubscriptionAddOn | null> {
            try {
                return await fetchApi<QZPaySubscriptionAddOn>(
                    `/subscriptions/${subscriptionId}/addons/${addOnId}`
                );
            } catch (error) {
                if ((error as Error).message.includes('not found')) {
                    return null;
                }
                throw error;
            }
        }
    };

    // Transaction stub (not supported on client)
    async function transaction<T>(fn: () => Promise<T>): Promise<T> {
        // Client-side doesn't support transactions - just execute the function
        return fn();
    }

    return {
        customers,
        subscriptions,
        payments,
        paymentMethods,
        invoices,
        plans,
        prices,
        promoCodes,
        vendors,
        entitlements,
        limits,
        addons,
        transaction
    };
}

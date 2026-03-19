/**
 * HTTP-based customer storage implementation
 */
import type {
    QZPayCreateCustomerInput,
    QZPayCustomer,
    QZPayCustomerStorage,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPayUpdateCustomerInput
} from '@qazuor/qzpay-core';

import { billingFetch } from './billing-fetch';

/**
 * Create HTTP-based customer storage implementation
 */
export function createCustomerStorage(): QZPayCustomerStorage {
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

/**
 * HTTP-based subscription, payment, and payment method storage implementations
 */
import type {
    QZPayCreatePaymentMethodInput,
    QZPayCreateSubscriptionInput,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPayPayment,
    QZPayPaymentMethod,
    QZPayPaymentMethodStorage,
    QZPayPaymentStorage,
    QZPaySubscription,
    QZPaySubscriptionStorage,
    QZPayUpdatePaymentMethodInput,
    QZPayUpdateSubscriptionInput
} from '@qazuor/qzpay-core';

import { billingFetch } from './billing-fetch';

/**
 * Create HTTP-based subscription storage implementation
 */
export function createSubscriptionStorage(): QZPaySubscriptionStorage {
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
export function createPaymentStorage(): QZPayPaymentStorage {
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
export function createPaymentMethodStorage(): QZPayPaymentMethodStorage {
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

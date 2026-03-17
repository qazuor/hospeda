/**
 * HTTP-based plan, price, promo code, and invoice storage implementations
 */
import type {
    QZPayCreateInvoiceInput,
    QZPayCreatePlanInput,
    QZPayCreatePriceInput,
    QZPayCreatePromoCodeInput,
    QZPayInvoice,
    QZPayInvoiceStorage,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPayPlan,
    QZPayPlanStorage,
    QZPayPrice,
    QZPayPriceStorage,
    QZPayPromoCode,
    QZPayPromoCodeStorage
} from '@qazuor/qzpay-core';

import { billingFetch } from './billing-fetch';

/**
 * Create HTTP-based invoice storage implementation
 */
export function createInvoiceStorage(): QZPayInvoiceStorage {
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
export function createPlanStorage(): QZPayPlanStorage {
    return {
        create: async (input: QZPayCreatePlanInput & { id: string }) => {
            return billingFetch<QZPayPlan>('/api/v1/admin/billing/plans', 'POST', input);
        },

        update: async (id: string, plan: Partial<QZPayPlan>) => {
            return billingFetch<QZPayPlan>(`/api/v1/admin/billing/plans/${id}`, 'PUT', plan);
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/admin/billing/plans/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayPlan>(`/api/v1/admin/billing/plans/${id}`);
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayPlan>>(
                `/api/v1/admin/billing/plans?${params.toString()}`
            );
        }
    };
}

/**
 * Create HTTP-based price storage implementation
 */
export function createPriceStorage(): QZPayPriceStorage {
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
export function createPromoCodeStorage(): QZPayPromoCodeStorage {
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

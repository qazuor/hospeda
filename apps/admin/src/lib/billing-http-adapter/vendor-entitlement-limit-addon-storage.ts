/**
 * HTTP-based vendor, entitlement, limit, and add-on storage implementations
 */
import type {
    QZPayAddOn,
    QZPayAddOnStorage,
    QZPayCreateAddOnInput,
    QZPayCreateVendorInput,
    QZPayCustomerEntitlement,
    QZPayCustomerLimit,
    QZPayEntitlement,
    QZPayEntitlementStorage,
    QZPayGrantEntitlementInput,
    QZPayIncrementLimitInput,
    QZPayLimit,
    QZPayLimitStorage,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPaySetLimitInput,
    QZPaySourceType,
    QZPaySubscriptionAddOn,
    QZPayUpdateAddOnInput,
    QZPayUpdateVendorInput,
    QZPayUsageRecord,
    QZPayVendor,
    QZPayVendorPayout,
    QZPayVendorStorage
} from '@qazuor/qzpay-core';

import { billingFetch } from './billing-fetch';

/**
 * Create HTTP-based vendor storage implementation
 */
export function createVendorStorage(): QZPayVendorStorage {
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
export function createEntitlementStorage(): QZPayEntitlementStorage {
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

        /**
         * Revoke all entitlements granted by a specific source.
         *
         * Calls the admin API endpoint that proxies the storage-level
         * `revokeBySource` operation. This endpoint is not exposed by
         * qzpay-hono and must be handled by a custom admin route.
         *
         * Returns the count of revoked entitlement records.
         *
         * @param source - Source type (e.g. 'addon', 'subscription')
         * @param sourceId - Identifier of the source record
         */
        revokeBySource: async (source: QZPaySourceType, sourceId: string): Promise<number> => {
            const result = await billingFetch<{ count: number }>(
                '/api/v1/protected/billing/entitlements/revoke-by-source',
                'POST',
                { source, sourceId }
            );
            return result.count;
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
export function createLimitStorage(): QZPayLimitStorage {
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

        /**
         * Delete a per-customer limit row identified by customer and limit key.
         *
         * Calls the admin API endpoint that proxies the storage-level
         * `delete` operation. This endpoint is not exposed by qzpay-hono
         * and must be handled by a custom admin route.
         *
         * @param customerId - Billing customer identifier
         * @param limitKey - Limit definition key to delete
         */
        delete: async (customerId: string, limitKey: string): Promise<void> => {
            await billingFetch(
                `/api/v1/protected/billing/limits/${customerId}/${limitKey}`,
                'DELETE'
            );
        },

        /**
         * Delete all per-customer limit rows granted by a specific source.
         *
         * Calls the admin API endpoint that proxies the storage-level
         * `deleteBySource` operation. This endpoint is not exposed by
         * qzpay-hono and must be handled by a custom admin route.
         *
         * Returns the count of deleted limit records.
         *
         * @param source - Source type (e.g. 'addon', 'subscription')
         * @param sourceId - Identifier of the source record
         */
        deleteBySource: async (source: QZPaySourceType, sourceId: string): Promise<number> => {
            const result = await billingFetch<{ count: number }>(
                '/api/v1/protected/billing/limits/delete-by-source',
                'POST',
                { source, sourceId }
            );
            return result.count;
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
export function createAddOnStorage(): QZPayAddOnStorage {
    return {
        create: async (input: QZPayCreateAddOnInput & { id: string }) => {
            return billingFetch<QZPayAddOn>('/api/v1/admin/billing/addons', 'POST', input);
        },

        update: async (id: string, input: QZPayUpdateAddOnInput) => {
            return billingFetch<QZPayAddOn>(`/api/v1/admin/billing/addons/${id}`, 'PUT', input);
        },

        delete: async (id: string) => {
            await billingFetch(`/api/v1/admin/billing/addons/${id}`, 'DELETE');
        },

        findById: async (id: string) => {
            return billingFetch<QZPayAddOn>(`/api/v1/admin/billing/addons/${id}`);
        },

        findByPlanId: async (planId: string) => {
            const params = new URLSearchParams({ planId });
            return billingFetch<QZPayAddOn[]>(`/api/v1/admin/billing/addons?${params.toString()}`);
        },

        list: async (options?: QZPayListOptions) => {
            const params = new URLSearchParams();
            if (options?.limit) params.append('limit', options.limit.toString());
            if (options?.offset) params.append('offset', options.offset.toString());
            return billingFetch<QZPayPaginatedResult<QZPayAddOn>>(
                `/api/v1/admin/billing/addons?${params.toString()}`
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

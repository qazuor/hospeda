/**
 * Customer Lookup Helper
 *
 * Centralizes customer detail retrieval from QZPay billing.
 * Used by cron jobs that need customer email/name for notifications.
 *
 * @module utils/customer-lookup
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { apiLogger } from './logger';

/**
 * Customer details returned by lookup
 */
export interface CustomerDetails {
    /** Customer email */
    email: string;
    /** Customer display name */
    name: string;
    /** Associated user ID (from metadata) */
    userId: string | null;
}

/**
 * Look up customer details from QZPay billing
 *
 * Retrieves customer email, name, and userId from the billing system.
 * Handles errors gracefully - returns null on failure.
 *
 * @param billing - QZPay billing instance
 * @param customerId - Billing customer ID
 * @returns Customer details or null if not found/error
 */
export async function lookupCustomerDetails(
    billing: QZPayBilling,
    customerId: string
): Promise<CustomerDetails | null> {
    try {
        const customer = await billing.customers.get(customerId);

        if (!customer) {
            apiLogger.warn({ customerId }, 'Customer not found in billing system');
            return null;
        }

        return {
            email: customer.email,
            name: String(customer.metadata?.name || customer.email),
            userId: customer.metadata?.userId ? String(customer.metadata.userId) : null
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.warn(
            {
                customerId,
                error: errorMessage
            },
            'Failed to look up customer details'
        );

        return null;
    }
}

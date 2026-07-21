/**
 * Customer Lookup Helper
 *
 * Centralizes customer detail retrieval from QZPay billing.
 * Used by cron jobs that need customer email/name for notifications.
 *
 * @module utils/customer-lookup
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { billingCustomers, eq, getDb } from '@repo/db';
import { apiLogger } from './logger';

/**
 * Customer details returned by lookup
 */
export interface CustomerDetails {
    /** Customer email */
    email: string;
    /** Customer display name */
    name: string;
    /** Associated user ID (from `billing_customers.external_id`) */
    userId: string | null;
}

/**
 * Resolves the Hospeda `users.id` for a billing customer via
 * `billing_customers.external_id` — the canonical user<->customer link used
 * throughout the codebase (see `subscription-pause.service.ts::resolveOwnerUserId`
 * for the same pattern). Never throws: DB failures are logged and degrade to
 * `null` so callers can still surface email/name (HOS-223).
 *
 * @param customerId - Billing customer ID
 * @returns The linked user ID, or null if not found/on error
 */
async function resolveUserIdFromExternalId(customerId: string): Promise<string | null> {
    try {
        const db = getDb();
        const rows = await db
            .select({ externalId: billingCustomers.externalId })
            .from(billingCustomers)
            .where(eq(billingCustomers.id, customerId))
            .limit(1);

        return rows[0]?.externalId ?? null;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.warn(
            { customerId, error: errorMessage },
            'Failed to resolve userId from billing_customers.external_id'
        );

        return null;
    }
}

/**
 * Look up customer details from QZPay billing
 *
 * Retrieves customer email and name from the billing system, and resolves the
 * associated Hospeda userId from `billing_customers.external_id` (the
 * canonical link — NOT `customer.metadata.userId`, which is never written).
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

        const userId = await resolveUserIdFromExternalId(customerId);

        return {
            email: customer.email,
            name: String(customer.metadata?.name || customer.email),
            userId
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

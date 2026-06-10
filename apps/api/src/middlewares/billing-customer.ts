/**
 * Billing Customer Middleware
 *
 * Resolves the authenticated user's billing customer id for downstream use.
 * Runs after actor resolution.
 *
 * This middleware:
 * - Runs AFTER actor middleware (requires authenticated user)
 * - LOOKS UP the billing customer by externalId (the user id), using cache
 * - Sets billingCustomerId in context (null when none exists yet)
 * - Silently skips (null) for guests / when billing is not enabled
 *
 * NOTE: this middleware does NOT create the customer. Creation happens
 * eagerly in the Better Auth signup databaseHook (see apps/api/src/lib/auth.ts)
 * and is non-blocking. Consumers MUST tolerate a null customer id — e.g. the
 * entitlement middleware falls back to role-appropriate default entitlements
 * when there is no customer yet (SPEC-143 smoke F-B1).
 */

import type { MiddlewareHandler } from 'hono';
import { BillingCustomerSyncService } from '../services/billing-customer-sync';
import { isGuestActor } from '../utils/actor';
import { apiLogger } from '../utils/logger';
import { getQZPayBilling } from './billing';

// Singleton instance of the sync service
let syncServiceInstance: BillingCustomerSyncService | null = null;

/**
 * Get or create the billing customer sync service instance
 */
function getSyncService(): BillingCustomerSyncService {
    if (!syncServiceInstance) {
        const billing = getQZPayBilling();
        syncServiceInstance = new BillingCustomerSyncService(billing, {
            cacheTtlMs: 300000, // 5 minutes
            throwOnError: false // Log silently, don't break requests
        });
    }
    return syncServiceInstance;
}

/**
 * Billing customer middleware
 *
 * Ensures authenticated users have a billing customer record.
 * Must run AFTER actor middleware.
 *
 * Sets the following context variables:
 * - billingCustomerId: The QZPay customer ID (string | null)
 *
 * @example
 * ```typescript
 * import { billingCustomerMiddleware } from './middlewares/billing-customer';
 *
 * // In app setup (after actor middleware)
 * app.use(actorMiddleware());
 * app.use(billingCustomerMiddleware());
 *
 * // In route handler
 * const billingCustomerId = c.get('billingCustomerId');
 * if (billingCustomerId) {
 *   // User has billing customer - can create subscriptions, etc.
 * }
 * ```
 */
export const billingCustomerMiddleware = (): MiddlewareHandler => {
    return async (c, next) => {
        // Check if billing is enabled
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            // Billing not enabled - set null and continue
            c.set('billingCustomerId', null);
            await next();
            return;
        }

        // Get actor from context (set by actor middleware)
        const actor = c.get('actor');

        // No actor or guest actor — skip the billing customer lookup entirely.
        // GUEST actors carry the sentinel UUID '00000000-0000-4000-8000-000000000000'
        // and never have a billing customer record. Doing the lookup wastes 10-50ms
        // per request and emits misleading "No billing customer found for authenticated
        // user" log lines on every public/healthcheck request. (SPEC-116)
        if (!actor || isGuestActor(actor) || !actor.id) {
            c.set('billingCustomerId', null);
            await next();
            return;
        }

        try {
            // Get sync service
            const _syncService = getSyncService();

            // Try to ensure customer exists
            // This will check cache first, then DB, then create if needed
            // We need email for customer creation, but actor doesn't have it
            // We'll check cache/DB only here, creation happens in auth/sync
            const billing = getQZPayBilling();

            if (!billing) {
                c.set('billingCustomerId', null);
                await next();
                return;
            }

            // Quick lookup by externalId (userId) - will use cache if available
            const customer = await billing.customers.getByExternalId(actor.id);

            if (customer) {
                // Customer exists - set in context
                c.set('billingCustomerId', customer.id);

                apiLogger.debug(
                    {
                        userId: actor.id,
                        customerId: customer.id
                    },
                    'Billing customer found for authenticated user'
                );
            } else {
                // Customer doesn't exist yet
                // This is normal for first-time login before auth/sync completes
                c.set('billingCustomerId', null);

                apiLogger.debug(
                    {
                        userId: actor.id,
                        note: 'Customer will be created on auth/sync'
                    },
                    'No billing customer found for authenticated user'
                );
            }
        } catch (error) {
            // Log error but don't break the request
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.warn(
                {
                    userId: actor.id,
                    error: errorMessage
                },
                'Error in billing customer middleware'
            );

            // Set null and continue - don't break the request
            c.set('billingCustomerId', null);
        }

        await next();
    };
};

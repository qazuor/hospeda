/**
 * Billing Ownership Verification Middleware
 *
 * Ensures that authenticated users can only access their own billing resources.
 * Intercepts QZPay pre-built route requests with `:id` parameters and verifies
 * that the target resource belongs to the requesting user's billing customer.
 *
 * Behavior:
 * - Billing disabled or no customer: pass through (handled by upstream middleware)
 * - No resource ID in path: pass through (list endpoints, webhooks, checkout creation)
 * - Resource belongs to user: allow request
 * - Resource does NOT belong to user: return 403 Forbidden
 * - Lookup errors: return 403 (fail closed for security)
 *
 * Resource verification rules:
 * - `/customers/:id` .. id must equal billingCustomerId
 * - `/subscriptions/:id` .. subscription.customerId must equal billingCustomerId
 * - `/invoices/:id` .. invoice.customerId must equal billingCustomerId
 * - `/payments/:id` .. payment.customerId must equal billingCustomerId
 * - `/entitlements/:id` .. entitlement.customerId must equal billingCustomerId
 *
 * @module middlewares/billing-ownership.middleware
 */

import { HTTPException } from 'hono/http-exception';
import type { AppMiddleware } from '../types';
import { apiLogger } from '../utils/logger';
import { getQZPayBilling } from './billing';

/**
 * Resource types whose `:id` parameter directly maps to a billing customer ID.
 * For these, the path param IS the customer ID.
 */
const DIRECT_CUSTOMER_RESOURCES = new Set(['customers']);

/**
 * Resource types that have a `customerId` property referencing the owning customer.
 * For these, we must look up the resource to check ownership.
 */
const LOOKUP_RESOURCES = new Set(['subscriptions', 'invoices', 'payments', 'entitlements']);

/**
 * Extracts the resource type and ID from a billing route path.
 *
 * Matches patterns like:
 * - `/subscriptions/sub_123` .. { resource: 'subscriptions', id: 'sub_123' }
 * - `/customers/cust_abc` .. { resource: 'customers', id: 'cust_abc' }
 * - `/invoices/inv_x/pay` .. { resource: 'invoices', id: 'inv_x' }
 * - `/subscriptions` .. null (no ID, list endpoint)
 *
 * @param path - Request path relative to billing mount point
 * @returns Parsed resource info or null if no ID segment found
 */
function extractResourceFromPath(path: string): { resource: string; id: string } | null {
    // Remove query string and normalize
    const cleanPath = path.split('?')[0]?.replace(/\/+$/, '') ?? '';

    // Split into segments, filtering empty strings
    const segments = cleanPath.split('/').filter(Boolean);

    // We need at least 2 segments: resource + id
    // The path is relative to billing mount (e.g., /customers/cust_123 or /subscriptions/sub_1/cancel)
    // Walk through segments to find known resource + next segment as ID
    for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        if (segment && (DIRECT_CUSTOMER_RESOURCES.has(segment) || LOOKUP_RESOURCES.has(segment))) {
            const id = segments[i + 1];
            if (id) {
                return { resource: segment, id };
            }
        }
    }

    return null;
}

/**
 * Looks up a billing resource and returns its owning customer ID.
 *
 * @param resource - Resource type (subscriptions, invoices, payments, entitlements)
 * @param id - Resource ID
 * @returns The customerId owning the resource, or null if not found
 */
async function getResourceCustomerId(resource: string, id: string): Promise<string | null> {
    const billing = getQZPayBilling();

    if (!billing) {
        return null;
    }

    try {
        switch (resource) {
            case 'subscriptions': {
                const subscription = await billing.subscriptions.get(id);
                return subscription?.customerId ?? null;
            }
            case 'invoices': {
                const invoice = await billing.invoices.get(id);
                return invoice?.customerId ?? null;
            }
            case 'payments': {
                const payment = await billing.payments.get(id);
                return payment?.customerId ?? null;
            }
            case 'entitlements': {
                // QZPayEntitlementService does not expose a get-by-id method.
                // Fail closed: deny access rather than allow unverified ownership.
                return null;
            }
            default:
                return null;
        }
    } catch {
        // Resource not found or DB error .. return null (will trigger 403)
        return null;
    }
}

/**
 * Billing ownership verification middleware factory.
 *
 * Prevents users from accessing billing resources that do not belong to them.
 * Must run AFTER:
 * - `billingCustomerMiddleware` (sets `billingCustomerId` on context)
 *
 * Should only be applied to QZPay pre-built routes (custom routes already
 * enforce ownership through `c.get('billingCustomerId')`).
 *
 * @returns Hono middleware handler bound to `AppBindings`
 *
 * @example
 * ```typescript
 * import { billingOwnershipMiddleware } from './middlewares/billing-ownership.middleware';
 *
 * // Apply to QZPay pre-built routes
 * const qzpayRoutes = createQZPayBillingRouter();
 * qzpayRoutes.use('*', billingOwnershipMiddleware());
 * router.route('/', qzpayRoutes);
 * ```
 */
export function billingOwnershipMiddleware(): AppMiddleware {
    return async (c, next) => {
        // Skip if billing is not enabled
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            await next();
            return;
        }

        // Check if no billing customer (unauthenticated or no customer yet)
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            // Check if the path targets a specific resource by ID
            const parsed = extractResourceFromPath(c.req.path);

            if (parsed?.id) {
                // Fail-closed: cannot access specific resources without billing customer
                apiLogger.warn(
                    { path: c.req.path, resource: parsed.resource, resourceId: parsed.id },
                    'Billing ownership denied: no billing customer ID for resource-specific route'
                );
                return c.json(
                    {
                        error: 'FORBIDDEN',
                        message: 'Billing account required to access this resource'
                    },
                    403
                );
            }

            // List endpoints, catalog, checkout - allow without billing customer
            await next();
            return;
        }

        // Extract resource type and ID from path
        const parsed = extractResourceFromPath(c.req.path);

        if (!parsed) {
            // No resource ID in path (list endpoint, webhook, checkout creation)
            await next();
            return;
        }

        const { resource, id } = parsed;

        // Direct customer resource: ID must match the user's billing customer
        if (DIRECT_CUSTOMER_RESOURCES.has(resource)) {
            if (id !== billingCustomerId) {
                apiLogger.warn(
                    {
                        billingCustomerId,
                        requestedCustomerId: id,
                        path: c.req.path
                    },
                    'Billing ownership denied: customer ID mismatch'
                );

                return c.json(
                    {
                        error: 'FORBIDDEN',
                        message: 'You do not have access to this billing resource'
                    },
                    403
                );
            }

            await next();
            return;
        }

        // Lookup resource: fetch and verify customerId
        if (LOOKUP_RESOURCES.has(resource)) {
            const resourceCustomerId = await getResourceCustomerId(resource, id);

            if (resourceCustomerId !== billingCustomerId) {
                apiLogger.warn(
                    {
                        billingCustomerId,
                        resourceCustomerId,
                        resource,
                        resourceId: id,
                        path: c.req.path
                    },
                    'Billing ownership denied: resource does not belong to user'
                );

                return c.json(
                    {
                        error: 'FORBIDDEN',
                        message: 'You do not have access to this billing resource'
                    },
                    403
                );
            }

            await next();
            return;
        }

        // Unknown resource type: fail closed rather than allow unverified access
        apiLogger.warn(
            { resourceType: resource, path: c.req.path },
            'Unknown billing resource type in ownership check'
        );
        throw new HTTPException(403, { message: 'Access denied: unknown resource type' });
    };
}

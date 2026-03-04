/**
 * Billing Admin Guard Middleware
 *
 * Restricts admin-only operations on QZPay pre-built routes to users with
 * ADMIN or SUPER_ADMIN roles. Regular users can only read their own resources.
 *
 * Admin-only operations (blocked for non-admin users):
 * - Plan management: POST/PUT/DELETE /plans
 * - Customer creation/deletion: POST/DELETE /customers
 * - Subscription creation/modification: POST/PUT/DELETE /subscriptions
 * - Invoice creation/voiding: POST /invoices, POST /invoices/:id/void
 * - Payment refunds: POST /payments/:id/refund
 * - Entitlement management: POST/DELETE /entitlements
 *
 * Allowed for all authenticated users:
 * - GET on any resource (filtered by ownership middleware)
 * - POST /checkout (self-service checkout)
 * - POST /webhooks (system webhooks)
 * - POST /invoices/:id/pay (pay own invoice)
 *
 * @module middlewares/billing-admin-guard.middleware
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { AppMiddleware } from '../types';
import { apiLogger } from '../utils/logger';

/** Actor shape extracted from context (subset of full Actor type) */
interface BillingActor {
    readonly id: string;
    readonly role?: string;
    readonly permissions?: readonly string[];
}

/**
 * Admin-only operation rules.
 * Each rule defines a URL segment pattern and restricted HTTP methods.
 * When a request matches, it must come from an admin user.
 */
const ADMIN_ONLY_RULES: ReadonlyArray<{
    /** URL segment to match (e.g., 'plans', 'entitlements') */
    readonly segment: string;
    /** HTTP methods that require admin access */
    readonly methods: ReadonlySet<string>;
    /** Optional sub-path exceptions that are allowed for regular users */
    readonly allowedSubPaths?: ReadonlySet<string>;
}> = [
    // Plans are catalog data.. only admins can create/modify/delete
    { segment: 'plans', methods: new Set(['POST', 'PUT', 'DELETE']) },

    // Customer creation and deletion are admin operations
    // (PUT is allowed for self-updates via ownership middleware)
    { segment: 'customers', methods: new Set(['POST', 'DELETE']) },

    // Subscription creation/modification are admin operations
    // (Users manage subscriptions via /trial/start and /subscriptions/change-plan)
    { segment: 'subscriptions', methods: new Set(['POST', 'PUT', 'DELETE']) },

    // Invoice creation and voiding are admin operations
    // Pay (/invoices/:id/pay) is allowed for users to pay their own invoices
    {
        segment: 'invoices',
        methods: new Set(['POST']),
        allowedSubPaths: new Set(['pay'])
    },

    // Payment refunds are admin operations
    { segment: 'payments', methods: new Set(['POST']) },

    // Entitlement management is admin-only
    { segment: 'entitlements', methods: new Set(['POST', 'DELETE']) }
] as const;

/**
 * Checks whether the given actor has admin-level access to billing operations.
 *
 * SUPER_ADMIN always has access. Other actors must have the ACCESS_API_ADMIN
 * permission explicitly granted, regardless of role.
 *
 * @param actor - The actor from context, or undefined if unauthenticated
 * @returns True if the actor should bypass admin guard restrictions
 */
function hasAdminAccess(actor: BillingActor | undefined): boolean {
    if (!actor) return false;
    if (actor.role === RoleEnum.SUPER_ADMIN) return true;
    if (!actor.permissions || !Array.isArray(actor.permissions)) return false;
    return actor.permissions.includes(PermissionEnum.ACCESS_API_ADMIN);
}

/**
 * Checks if a request path and method match an admin-only rule.
 *
 * @param path - Request path
 * @param method - HTTP method (uppercase)
 * @returns True if the operation requires admin access
 */
function isAdminOnlyOperation(path: string, method: string): boolean {
    const segments = path.split('/').filter(Boolean);

    for (const rule of ADMIN_ONLY_RULES) {
        const segmentIndex = segments.indexOf(rule.segment);

        if (segmentIndex === -1) {
            continue;
        }

        if (!rule.methods.has(method)) {
            continue;
        }

        // Check if there's an allowed sub-path exception
        if (rule.allowedSubPaths) {
            const subPath = segments[segmentIndex + 2]; // segment/:id/subPath

            if (subPath && rule.allowedSubPaths.has(subPath)) {
                continue;
            }
        }

        return true;
    }

    return false;
}

/**
 * Billing admin guard middleware factory.
 *
 * Blocks non-admin users from performing write operations on billing resources
 * that should be admin-only. Read operations (GET) are always allowed (the
 * ownership middleware handles resource-level access control).
 *
 * Must run AFTER `actorMiddleware` (sets `actor` on context).
 *
 * @returns Hono middleware handler bound to `AppBindings`
 */
export function billingAdminGuardMiddleware(): AppMiddleware {
    return async (c, next) => {
        const method = c.req.method.toUpperCase();

        // GET requests are always allowed (filtered by ownership middleware)
        if (method === 'GET') {
            await next();
            return;
        }

        // Check if this operation requires admin access
        if (!isAdminOnlyOperation(c.req.path, method)) {
            await next();
            return;
        }

        // Verify the actor has admin privileges (permission-based, not role-based)
        const actor = c.get('actor') as BillingActor | undefined;

        if (hasAdminAccess(actor)) {
            await next();
            return;
        }

        apiLogger.warn(
            {
                actorId: actor?.id,
                actorRole: actor?.role,
                method,
                path: c.req.path
            },
            'Billing admin guard: non-admin user attempted admin-only operation'
        );

        return c.json(
            {
                error: 'FORBIDDEN',
                message: 'This operation requires administrator privileges'
            },
            403
        );
    };
}

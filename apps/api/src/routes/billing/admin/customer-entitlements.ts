/**
 * Admin Customer Entitlement Routes
 *
 * Provides admin endpoints to manually grant or revoke a one-off entitlement
 * for a billing customer, bypassing subscription-based entitlement resolution.
 *
 * Routes:
 * - POST /api/v1/admin/billing/customer-entitlements/grant
 *     - Body: { customerId, entitlementKey, expiresAt? }
 *     - Validates customer exists via billing.customers.get() → 404 if not found
 *     - Calls billing.entitlements.grant() with source='manual'
 *     - Clears the entitlement cache for the customer
 * - POST /api/v1/admin/billing/customer-entitlements/revoke
 *     - Body: { customerId, entitlementKey }
 *     - Calls billing.entitlements.revoke()
 *     - Clears the entitlement cache for the customer
 *
 * Both routes use POST because the route-factory skips JSON body parsing for
 * DELETE requests (shouldParseBody = false), which would cause the Zod schema
 * to always receive {} and return 400. POST body-carrying mutations are
 * unambiguous and match the action-verb POST pattern used by customer-addons.ts
 * (POST /expire, POST /activate).
 *
 * Permissions: PermissionEnum.BILLING_MANAGE (matches sibling billing admin
 * mutation routes — addons.ts, plans.ts).
 *
 * Note on 201-on-revoke: the createAdminRoute factory (via createCRUDRoute)
 * returns 201 for all POST routes by default. The revoke route logically maps
 * to 204 (no-content mutation), but the factory does not support POST→204.
 * API consumers must treat 201 from POST /revoke as "success, no body".
 *
 * @module routes/billing/admin/customer-entitlements
 */

import { isEntitlementKey } from '@repo/billing';
import { PermissionEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor';
import { getQZPayBilling } from '../../../middlewares/billing';
import { clearEntitlementCache } from '../../../middlewares/entitlement';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

// ---------------------------------------------------------------------------
// Request schemas (inline — billing admin routes use inline schemas throughout)
// ---------------------------------------------------------------------------

/**
 * Zod schema for the grant-entitlement request body.
 *
 * entitlementKey is validated against the EntitlementKey enum at runtime so
 * an unknown key is rejected with 400 before reaching the billing service.
 */
const GrantEntitlementBodySchema = z.object({
    /** QZPay billing customer ID */
    customerId: z.string().min(1, 'customerId is required'),
    /** Entitlement key to grant — must be a known EntitlementKey value */
    entitlementKey: z
        .string()
        .min(1, 'entitlementKey is required')
        .refine(isEntitlementKey, { message: 'Unknown entitlementKey value' }),
    /**
     * Optional expiry — grant expires at this date if provided.
     * Must be a future date; past dates are rejected with 400.
     */
    expiresAt: z.coerce
        .date()
        .refine((d) => d > new Date(), { message: 'expiresAt must be in the future' })
        .optional()
});

/**
 * Zod schema for the revoke-entitlement request body.
 */
const RevokeEntitlementBodySchema = z.object({
    /** QZPay billing customer ID */
    customerId: z.string().min(1, 'customerId is required'),
    /** Entitlement key to revoke — must be a known EntitlementKey value */
    entitlementKey: z
        .string()
        .min(1, 'entitlementKey is required')
        .refine(isEntitlementKey, { message: 'Unknown entitlementKey value' })
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

/** Shape of a successful grant response */
const GrantEntitlementResponseSchema = z.object({
    customerId: z.string(),
    entitlementKey: z.string(),
    grantedAt: z.coerce.date(),
    expiresAt: z.coerce.date().nullable(),
    source: z.string(),
    sourceId: z.string().nullable()
});

/** Revoke returns a 204-style null body */
const RevokeEntitlementResponseSchema = z.null();

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/admin/billing/customer-entitlements/grant
 *
 * Grants a one-off entitlement to a billing customer. Uses source='manual'
 * and sourceId=<admin actor id> for auditability. Clears the entitlement
 * cache for the customer so the next request reflects the new grant.
 *
 * Body: { customerId, entitlementKey, expiresAt? }
 * Permission: BILLING_MANAGE
 */
export const adminGrantCustomerEntitlementRoute = createAdminRoute({
    method: 'post',
    path: '/grant',
    summary: 'Grant a one-off entitlement to a customer (admin)',
    description:
        'Manually grants a named entitlement to a billing customer, bypassing plan entitlements. ' +
        'source is always "manual"; sourceId is the admin actor ID. ' +
        'The entitlement cache for the customer is cleared after granting so the next request picks it up.',
    tags: ['Billing', 'Entitlements'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestBody: GrantEntitlementBodySchema,
    responseSchema: GrantEntitlementResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c: Context, _params: unknown, body: unknown) => {
        const actor = getActorFromContext(c);
        // The route-factory pre-validates body via ctx.req.valid('json') with
        // GrantEntitlementBodySchema (including coercion for expiresAt). We
        // re-parse here only to carry the narrowed TypeScript type into this
        // handler scope — the factory does not expose a typed getter in the
        // generic handler signature.
        const input = GrantEntitlementBodySchema.parse(body);

        const billing = getQZPayBilling();
        if (!billing) {
            throw new HTTPException(503, { message: 'Billing service is not available' });
        }

        // Validate that the billing customer exists before attempting to grant.
        // A missing customer means the caller passed the wrong ID; return 404
        // rather than letting the billing adapter create a phantom record.
        const customer = await billing.customers.get(input.customerId);
        if (!customer) {
            throw new HTTPException(404, {
                message: `Billing customer not found: ${input.customerId}`
            });
        }

        apiLogger.info(
            {
                customerId: input.customerId,
                entitlementKey: input.entitlementKey,
                actorId: actor.id
            },
            'Admin granting customer entitlement'
        );

        // Narrow entitlementKey from string to EntitlementKey using the type
        // guard (same guard used by the Zod .refine above — no redundant cast).
        if (!isEntitlementKey(input.entitlementKey)) {
            // This branch is unreachable in practice: the Zod schema's .refine
            // already rejected any unknown key before the handler was invoked.
            // The guard is retained for TypeScript narrowing only.
            throw new HTTPException(400, { message: 'Unknown entitlementKey value' });
        }

        // QZPayGrantEntitlementInput: { customerId, entitlementKey, expiresAt?, source?, sourceId? }
        const granted = await billing.entitlements.grant({
            customerId: input.customerId,
            entitlementKey: input.entitlementKey,
            expiresAt: input.expiresAt,
            source: 'manual',
            sourceId: actor.id
        });

        // Invalidate the in-process entitlement cache so the next request to this
        // API server reflects the newly granted entitlement without waiting for TTL.
        clearEntitlementCache(input.customerId);

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'create',
            resourceType: 'billing_customer_entitlement',
            resourceId: `${input.customerId}:${input.entitlementKey}`
        });

        return granted;
    }
});

/**
 * POST /api/v1/admin/billing/customer-entitlements/revoke
 *
 * Revokes a one-off customer entitlement. The underlying QZPay revoke call
 * is a hard-delete of the customer_entitlements row. Clears the entitlement
 * cache so the next request no longer sees the revoked entitlement.
 *
 * Uses POST (not DELETE) because the route-factory skips JSON body parsing
 * for DELETE methods, which would cause Zod validation to always fail with
 * 400. Matches the action-verb POST pattern used by customer-addons.ts.
 *
 * Body: { customerId, entitlementKey }
 * Permission: BILLING_MANAGE
 */
export const adminRevokeCustomerEntitlementRoute = createAdminRoute({
    method: 'post',
    path: '/revoke',
    summary: 'Revoke a customer entitlement (admin)',
    description:
        'Revokes a named entitlement from a billing customer. ' +
        'The customer_entitlements row for this (customerId, entitlementKey) pair is deleted. ' +
        'The entitlement cache for the customer is cleared after revocation.',
    tags: ['Billing', 'Entitlements'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestBody: RevokeEntitlementBodySchema,
    responseSchema: RevokeEntitlementResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c: Context, _params: unknown, body: unknown) => {
        const actor = getActorFromContext(c);
        // Re-parse to carry typed fields into this scope (same reasoning as
        // the grant handler — factory pre-validates but handler receives unknown).
        const input = RevokeEntitlementBodySchema.parse(body);

        const billing = getQZPayBilling();
        if (!billing) {
            throw new HTTPException(503, { message: 'Billing service is not available' });
        }

        apiLogger.info(
            {
                customerId: input.customerId,
                entitlementKey: input.entitlementKey,
                actorId: actor.id
            },
            'Admin revoking customer entitlement'
        );

        // billing.entitlements.revoke(customerId: string, entitlementKey: string): Promise<void>
        await billing.entitlements.revoke(input.customerId, input.entitlementKey);

        // Invalidate cache so the next request no longer serves the revoked entitlement.
        clearEntitlementCache(input.customerId);

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'delete',
            resourceType: 'billing_customer_entitlement',
            resourceId: `${input.customerId}:${input.entitlementKey}`
        });

        return null;
    }
});

// ---------------------------------------------------------------------------
// Router composition
// ---------------------------------------------------------------------------

/**
 * Admin customer-entitlements router.
 * Mounted under /api/v1/admin/billing/customer-entitlements by admin/index.ts.
 */
export const adminCustomerEntitlementsRouter = createRouter();

adminCustomerEntitlementsRouter.route('/', adminGrantCustomerEntitlementRoute);
adminCustomerEntitlementsRouter.route('/', adminRevokeCustomerEntitlementRoute);

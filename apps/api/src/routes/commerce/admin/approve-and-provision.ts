/**
 * @file approve-and-provision.ts
 * @description Admin endpoint that approves a commerce lead AND provisions its
 * COMMERCE_OWNER account in a single action (SPEC-249 Part D / AC-6).
 *
 * ## Flow
 * 1. Build the per-request provisioning service (ports capture Better Auth
 *    request headers + the site URL for the credentials email).
 * 2. Delegate to {@link CommerceLeadService.approveAndProvision}, which:
 *    - returns a no-op result when the lead is already provisioned
 *      (idempotency guard via `provisionedUserId`);
 *    - otherwise provisions the owner FIRST (so a failure leaves the lead
 *      unhandled and retryable), then marks it approved + links the user.
 * 3. Return `{ lead, userId, provisioned }` — NEVER the temporary password.
 *
 * ## Security
 * - Gated by `PermissionEnum.COMMERCE_EDIT_ALL` (enforced by `createAdminRoute`
 *   and double-checked inside both services).
 *
 * @module routes/commerce/admin/approve-and-provision
 */

import { CommerceLeadSchema, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import {
    CommerceLeadService,
    CommerceOwnerProvisioningService,
    ServiceError
} from '@repo/service-core';
import { z } from 'zod';
import {
    createCommerceOwnerCreateUserPort,
    createCommerceOwnerCredentialsNotificationPort
} from '../../../lib/commerce-ports';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Optional admin note recorded on the lead when approving. */
const ApproveAndProvisionBodySchema = z.object({
    adminNote: z.string().max(1000).optional()
});

/**
 * Response: the updated lead plus the provisioned owner's id and whether a new
 * account was created this call. The temporary password never leaves the
 * provisioning service (delivered by email only).
 */
const ApproveAndProvisionResponseSchema = z.object({
    /** The updated lead (status 'approved', linked to the provisioned owner). */
    lead: CommerceLeadSchema,
    /** UUID of the provisioned COMMERCE_OWNER user. */
    userId: z.string().uuid(),
    /** `true` when a new owner account was created; `false` when already provisioned. */
    provisioned: z.boolean()
});

// ---------------------------------------------------------------------------
// Service instance (module-scoped, stateless)
// ---------------------------------------------------------------------------

const commerceLeadService = new CommerceLeadService({ logger: apiLogger });

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/admin/commerce/leads/:id/approve-and-provision
 *
 * Approves the lead and provisions its COMMERCE_OWNER account in one step.
 *
 * Status codes:
 * - `201` — approved + provisioned (or already provisioned, idempotent).
 * - `403` — actor lacks `COMMERCE_EDIT_ALL`.
 * - `404` — lead not found.
 * - `500` — provisioning failed (lead left unhandled for retry).
 */
export const adminApproveAndProvisionRoute = createAdminRoute({
    method: 'post',
    path: '/:id/approve-and-provision',
    summary: 'Approve a commerce lead and provision its owner (admin)',
    description:
        'Approves the specified commerce lead and provisions its COMMERCE_OWNER account in a ' +
        'single action: creates the owner user, sends the credentials email, marks the lead ' +
        'approved, and links the provisioned user. Idempotent — re-approving never ' +
        'double-provisions. Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Commerce'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'Lead ID must be a valid UUID' })
    },
    requestBody: ApproveAndProvisionBodySchema,
    responseSchema: ApproveAndProvisionResponseSchema,
    successStatusCode: 201,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const leadId = params.id as string;
        const { adminNote } = body as z.infer<typeof ApproveAndProvisionBodySchema>;

        // Build ports per-request so they capture the current request headers
        // (Better Auth origin / cookie context) and the configured site URL.
        const createUser = createCommerceOwnerCreateUserPort(ctx.req.raw.headers);
        const notifier = createCommerceOwnerCredentialsNotificationPort(env.HOSPEDA_SITE_URL);
        const provisioner = new CommerceOwnerProvisioningService(
            { logger: apiLogger },
            createUser,
            notifier
        );

        const result = await commerceLeadService.approveAndProvision(
            actor,
            {
                id: leadId,
                handledById: actor.id,
                ...(adminNote !== undefined ? { adminNote } : {})
            },
            provisioner
        );

        if (result.error || !result.data) {
            throw new ServiceError(
                result.error?.code ?? ServiceErrorCode.INTERNAL_ERROR,
                result.error?.message ?? 'Approve-and-provision failed'
            );
        }

        return result.data;
    }
});

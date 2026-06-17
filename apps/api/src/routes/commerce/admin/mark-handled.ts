/**
 * Admin commerce lead mark-handled endpoint (SPEC-239 T-047)
 *
 * Approves or rejects a commerce lead (workflow transition).
 * Requires COMMERCE_EDIT_ALL permission (enforced in the service layer).
 *
 * @module routes/commerce/admin/mark-handled
 */

import { CommerceLeadSchema, PermissionEnum } from '@repo/schemas';
import { CommerceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const commerceLeadService = new CommerceLeadService({ logger: apiLogger });

/**
 * Request body for the mark-handled action.
 * `id` comes from the URL param; body carries status + optional adminNote.
 */
const MarkHandledBodySchema = z.object({
    /**
     * New workflow status: must be 'approved' or 'rejected'.
     * 'pending' and 'reviewing' transitions should use a dedicated
     * status-update endpoint when that workflow is extended.
     */
    status: z.enum(['approved', 'rejected']),
    /**
     * Optional internal note from the admin explaining the decision.
     * Max 1000 characters (matches DB column length).
     */
    adminNote: z.string().max(1000).optional()
});

/** Typed body for use inside the handler after the cast. */
type MarkHandledBody = z.infer<typeof MarkHandledBodySchema>;

/**
 * POST /api/v1/admin/commerce/leads/:id/handle
 *
 * Marks a lead as handled (approved or rejected) and records the admin who
 * acted and the timestamp.  Idempotent: re-handling an already-handled lead
 * overwrites the previous decision.
 *
 * Permission: COMMERCE_EDIT_ALL (enforced inside CommerceLeadService.markHandled).
 */
export const adminMarkHandledRoute = createAdminRoute({
    method: 'post',
    path: '/:id/handle',
    summary: 'Mark a commerce lead as handled (admin)',
    description:
        'Approves or rejects a commerce lead.  ' + 'Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Commerce'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'Lead ID must be a valid UUID' })
    },
    requestBody: MarkHandledBodySchema,
    responseSchema: CommerceLeadSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { status, adminNote } = body as MarkHandledBody;

        const result = await commerceLeadService.markHandled(actor, {
            id: params.id as string,
            status,
            handledById: actor.id,
            adminNote
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // biome-ignore lint/style/noNonNullAssertion: result.data is defined when result.error is absent
        return result.data!;
    }
});

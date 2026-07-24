/**
 * Admin alliance lead mark-handled endpoint (HOS-277 §6.3)
 *
 * Approves or rejects an alliance lead (workflow transition).
 * Requires ALLIANCE_LEAD_MANAGE permission (enforced in the service layer).
 * Never auto-provisions any role/entity (HOS-277 NG-1) — the admin
 * provisions the corresponding partner/sponsor/editor/HostTrade entry by
 * hand after approving.
 *
 * @module routes/alliance/admin/mark-handled
 */

import { AllianceLeadSchema, PermissionEnum } from '@repo/schemas';
import { AllianceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const allianceLeadService = new AllianceLeadService({ logger: apiLogger });

/**
 * Request body for the mark-handled action.
 * `id` comes from the URL param; body carries status + optional adminNote.
 * Mirrors `AllianceLeadMarkHandledSchema` (@repo/schemas), redeclared locally
 * with `z.enum(...)` (instead of `.refine()`) so the inferred TS type narrows
 * to exactly `'approved' | 'rejected'` — same convention as commerce's
 * `MarkHandledBodySchema` (`apps/api/src/routes/commerce/admin/mark-handled.ts`).
 * Runtime validation is defense-in-depth: the service layer re-validates via
 * `AllianceLeadMarkHandledSchema`.
 */
const MarkHandledBodySchema = z.object({
    /**
     * New workflow status: must be 'approved' or 'rejected'.
     * 'pending' and 'reviewing' transitions are internal-only in V1.
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
 * POST /api/v1/admin/alliance/leads/:id/mark-handled
 *
 * Marks a lead as handled (approved or rejected) and records the admin who
 * acted (via `updatedById`). Idempotent: re-handling an already-handled
 * lead overwrites the previous decision.
 *
 * Permission: ALLIANCE_LEAD_MANAGE (enforced inside AllianceLeadService.markHandled).
 */
export const adminMarkAllianceLeadHandledRoute = createAdminRoute({
    method: 'post',
    path: '/:id/mark-handled',
    summary: 'Mark an alliance lead as handled (admin)',
    description:
        'Approves or rejects an alliance lead. Requires ALLIANCE_LEAD_MANAGE ' +
        'permission. Never auto-provisions any role/entity (HOS-277 NG-1).',
    tags: ['Alliance'],
    requiredPermissions: [PermissionEnum.ALLIANCE_LEAD_MANAGE],
    requestParams: {
        id: z.string().uuid({ message: 'Lead ID must be a valid UUID' })
    },
    requestBody: MarkHandledBodySchema,
    responseSchema: AllianceLeadSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { status, adminNote } = body as MarkHandledBody;

        const result = await allianceLeadService.markHandled({
            actor,
            id: params.id as string,
            input: { status, adminNote }
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // biome-ignore lint/style/noNonNullAssertion: result.data is defined when result.error is absent
        return result.data!;
    }
});

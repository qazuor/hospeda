/**
 * Admin partner revocation endpoint (HOS-278 R-4).
 *
 * ```
 * POST /api/v1/admin/partners/:id/revoke
 * ```
 *
 * R-4 is "aprobar deja de ser reversible sin costo — definir el camino de
 * reversa". This is that path: the partner comes off the public surfaces, the
 * decision gets an author and a reason, and the row survives so the audit
 * question that follows ("who took this down, and why?") has an answer.
 *
 * @module routes/partners/admin/revoke
 */

import { PermissionEnum, partnerSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createPartnerRevokeNotifyPort } from '../../../lib/partner-ports';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

// The notify port is injected here rather than imported by the service, so
// `@repo/service-core` stays free of the notification transport.
const partnerService = new PartnerService({
    logger: apiLogger,
    revokeNotifier: createPartnerRevokeNotifyPort()
});

/**
 * Body for a revocation.
 *
 * `reason` is required and non-empty. The whole point of keeping the row is
 * that "why is this partner no longer listed?" has an answer; accepting a
 * blank one would leave the same gap deleting would.
 */
const RevokePartnerBodySchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.partner.revokeReason.required' })
        .max(1000, { message: 'zodError.partner.revokeReason.max' })
});

/**
 * POST /api/v1/admin/partners/{id}/revoke
 * Revoke a partner listing — Admin endpoint.
 */
export const adminRevokePartnerRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/revoke',
    summary: 'Revoke partner listing',
    description:
        'Takes a partner off the public surfaces while keeping the row, recording the acting admin, the timestamp and the reason, and emailing the owner. Flips lifecycleState to INACTIVE and deliberately leaves subscriptionStatus alone, so a revocation is never confused with a lapsed payment. Unlike soft-delete, a revoked partner stays visible to admins. Re-revoking is a no-op and never overwrites the original reason. Requires PARTNER_MANAGE permission.',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { id: z.string().uuid() },
    requestBody: RevokePartnerBodySchema,
    responseSchema: partnerSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { reason } = body as z.infer<typeof RevokePartnerBodySchema>;

        const result = await partnerService.revoke(actor, { id, reason });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data?.partner;
    }
});

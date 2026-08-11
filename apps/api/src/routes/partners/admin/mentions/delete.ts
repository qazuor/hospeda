/**
 * Admin removal endpoint for a mistakenly logged mention (HOS-377 T-015).
 *
 * Soft only, never hard: a mention the partner was told about by email and that
 * then vanishes without trace is worse than one marked removed, and the admin who
 * removed it stays on the row.
 */
import { PermissionEnum } from '@repo/schemas';
import { PartnerMentionService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { AuditEventType, auditLog } from '../../../../utils/audit-logger';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * DELETE /api/v1/admin/partners/{partnerId}/mentions/{id}
 * Soft-delete one logged mention - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminDeletePartnerMentionRoute = createAdminRoute({
    method: 'delete',
    path: '/{partnerId}/mentions/{id}',
    summary: 'Remove a logged partner mention (admin)',
    description: 'Soft-deletes one mention. The row is retained with the remover recorded on it.',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { partnerId: z.string().uuid(), id: z.string().uuid() },
    responseSchema: z.object({
        success: z.literal(true),
        message: z.string()
    }),
    handler: async (ctx, params) => {
        const mentionService = new PartnerMentionService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const partnerId = params.partnerId as string;
        const id = params.id as string;

        const result = await mentionService.remove(actor, { partnerId, id });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'delete',
            resourceType: 'partner-mention',
            resourceId: id,
            metadata: { partnerId }
        });

        return {
            success: true as const,
            message: 'Mention removed successfully'
        };
    }
});

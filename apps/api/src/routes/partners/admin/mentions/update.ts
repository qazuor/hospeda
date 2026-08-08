/**
 * Admin correction endpoint for a single logged mention (HOS-377 T-014).
 *
 * These rows are typed in by a human at the moment they act, so a wrong date or a
 * link pasted from the wrong tab is a matter of when, not if.
 */
import {
    PermissionEnum,
    partnerMentionSchema,
    type UpdatePartnerMention,
    updatePartnerMentionSchema
} from '@repo/schemas';
import { PartnerMentionService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { AuditEventType, auditLog } from '../../../../utils/audit-logger';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * PATCH /api/v1/admin/partners/{partnerId}/mentions/{id}
 * Correct one logged mention - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminUpdatePartnerMentionRoute = createAdminRoute({
    method: 'patch',
    path: '/{partnerId}/mentions/{id}',
    summary: 'Correct a logged partner mention (admin)',
    description:
        'Updates one mention. The channel, date, link and internal note are correctable; the owning partner and the batch are not.',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { partnerId: z.string().uuid(), id: z.string().uuid() },
    requestBody: updatePartnerMentionSchema,
    responseSchema: partnerMentionSchema,
    handler: async (ctx, params, body) => {
        const mentionService = new PartnerMentionService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const partnerId = params.partnerId as string;
        const id = params.id as string;

        // Both path segments are passed on: the service checks the mention really
        // belongs to this partner rather than trusting the URL to be coherent.
        const result = await mentionService.correct(actor, {
            partnerId,
            id,
            data: body as UpdatePartnerMention
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'partner-mention',
            resourceId: id,
            metadata: { partnerId, fields: Object.keys((body as UpdatePartnerMention) ?? {}) }
        });

        return result.data?.mention;
    }
});

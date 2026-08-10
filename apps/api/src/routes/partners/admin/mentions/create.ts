/**
 * Admin batch-create endpoint for the partner mentions log (HOS-377 T-012).
 *
 * One submission, N rows, one transaction, one email — the fan-out is handled by
 * `PartnerMentionService.createBatch`, which also mints the `batchId`.
 */
import {
    type CreatePartnerMentionBatch,
    createPartnerMentionBatchSchema,
    type PartnerMention,
    PermissionEnum,
    partnerMentionSchema
} from '@repo/schemas';
import { PartnerMentionService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { createPartnerMentionNotifyPort } from '../../../../lib/partner-ports';
import { getActorFromContext } from '../../../../utils/actor';
import { AuditEventType, auditLog } from '../../../../utils/audit-logger';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * POST /api/v1/admin/partners/{partnerId}/mentions
 * Log one promotion action across N channels - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminCreatePartnerMentionsRoute = createAdminRoute({
    method: 'post',
    path: '/{partnerId}/mentions',
    summary: 'Log partner mentions (admin)',
    description:
        'Records one promotion action across one or more channels. Entries submitted together share a batch id and produce a single notification.',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { partnerId: z.string().uuid() },
    requestBody: createPartnerMentionBatchSchema,
    responseSchema: z.object({ mentions: z.array(partnerMentionSchema) }),
    handler: async (ctx, params, body) => {
        // The notifier is injected HERE rather than owned by the service: the
        // transport, the `users`/`partners` reads and the email copy all live in
        // this app, and `@repo/service-core` stays free of them. A context that
        // injects none simply does not send (AC-9).
        const mentionService = new PartnerMentionService({
            logger: apiLogger,
            notifier: createPartnerMentionNotifyPort()
        });
        const actor = getActorFromContext(ctx);
        const partnerId = params.partnerId as string;

        // `body` is the schema's PARSED output, not the raw request. That is what
        // makes the stripping of `partnerId` and `batchId` mean anything: the path
        // below is the only source for who the mention belongs to, and a raw body
        // would let a caller file it into another partner's batch (R-5).
        const parsed = body as CreatePartnerMentionBatch;

        const result = await mentionService.createBatch(actor, { ...parsed, partnerId });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'create',
            resourceType: 'partner-mention',
            resourceId: partnerId,
            metadata: {
                batchId: result.data?.mentions[0]?.batchId ?? null,
                channels: (result.data?.mentions ?? []).map(
                    (mention: PartnerMention) => mention.channel
                )
            }
        });

        return { mentions: result.data?.mentions ?? [] };
    }
});

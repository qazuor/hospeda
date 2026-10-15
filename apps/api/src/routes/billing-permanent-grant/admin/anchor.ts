import {
    PermanentGrantAnchorBodySchema,
    PermanentGrantAnchorParamsSchema,
    type PermanentGrantAnchorResponse,
    PermanentGrantAnchorResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import { anchorPermanentGrantVertical } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { buildPermanentGrantPorts } from './ports.js';
import { answerRejection } from './rejections.js';

/** POST a new vertical anchor; service authorization remains authoritative. */
export const adminAnchorPermanentGrantRoute = createAdminRoute({
    method: 'post',
    path: '/{permanentGrantId}/anchors',
    summary: 'Anchor a vertical to a permanent grant (ACC:2)',
    description:
        'Adds one vertical anchor. billing.grantComplimentary is the route scope; the service decides the action permission, subject and system actor.',
    tags: ['Billing permanent grants', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: PermanentGrantAnchorParamsSchema.shape,
    requestBody: PermanentGrantAnchorBodySchema,
    responseSchema: PermanentGrantAnchorResponseSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const { permanentGrantId } = PermanentGrantAnchorParamsSchema.parse(params);
        const input = PermanentGrantAnchorBodySchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await anchorPermanentGrantVertical(
                { actor, permanentGrantId, ...input },
                buildPermanentGrantPorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'permanent_grant',
                resourceId: permanentGrantId,
                metadata: {
                    administrativeAction: 'ACC_2',
                    transition: 'S13',
                    anchorId: result.anchorId,
                    vertical: input.vertical,
                    planId: input.planId,
                    floorPlanVersionId: input.floorPlanVersionId,
                    cancelledSubscriptionIds: result.cancelledSubscriptionIds,
                    releasedRetentionIds: result.releasedRetentionIds,
                    closedCourtesyIds: result.closedCourtesyIds,
                    providerCalls: result.providerCalls,
                    anchoredAddonInstanceIds: result.anchoredAddonInstanceIds,
                    addonProviderCalls: result.addonProviderCalls
                }
            });
            const response: PermanentGrantAnchorResponse = {
                ...result,
                cancelledSubscriptionIds: [...result.cancelledSubscriptionIds],
                releasedRetentionIds: [...result.releasedRetentionIds],
                closedCourtesyIds: [...result.closedCourtesyIds],
                providerCalls: result.providerCalls.map((call) => ({ ...call })),
                anchoredAddonInstanceIds: [...result.anchoredAddonInstanceIds],
                addonProviderCalls: result.addonProviderCalls.map((call) => ({ ...call }))
            };
            return response;
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

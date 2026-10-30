import {
    PermanentGrantCreateRequestSchema,
    type PermanentGrantCreateResponse,
    PermanentGrantCreateResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import { grantPermanentGrant } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { buildPermanentGrantPorts } from './ports.js';
import { answerRejection } from './rejections.js';

/** POST grant; the service decides ACC_2 subject and system-actor authorization transactionally. */
export const adminGrantPermanentGrantRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create a permanent grant (ACC:2)',
    description:
        'Creates a permanent grant. billing.grantComplimentary is the route scope; the service decides the action permission, subject and system actor.',
    tags: ['Billing permanent grants', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestBody: PermanentGrantCreateRequestSchema,
    responseSchema: PermanentGrantCreateResponseSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = PermanentGrantCreateRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await grantPermanentGrant(
                { actor, ...input },
                buildPermanentGrantPorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'permanent_grant',
                resourceId: result.permanentGrantId,
                metadata: {
                    administrativeAction: 'ACC_2',
                    transition: 'S13',
                    subjectId: input.beneficiaryUserId,
                    includesAddons: input.includesAddons,
                    reason: input.reason,
                    verticals: input.anchors.map(({ vertical }) => vertical),
                    anchorIds: result.anchorIds,
                    cancelledSubscriptionIds: result.cancelledSubscriptionIds,
                    releasedRetentionIds: result.releasedRetentionIds,
                    closedCourtesyIds: result.closedCourtesyIds,
                    providerCalls: result.providerCalls,
                    anchoredAddonInstanceIds: result.anchoredAddonInstanceIds,
                    addonProviderCalls: result.addonProviderCalls
                }
            });
            const response: PermanentGrantCreateResponse = {
                ...result,
                anchorIds: [...result.anchorIds],
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

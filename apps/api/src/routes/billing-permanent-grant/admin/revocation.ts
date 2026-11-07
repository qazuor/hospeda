import {
    PermanentGrantRevocationParamsSchema,
    type PermanentGrantRevocationPreviewResponse,
    PermanentGrantRevocationPreviewResponseSchema,
    PermanentGrantRevocationRequestSchema,
    type PermanentGrantRevocationResponse,
    PermanentGrantRevocationResponseSchema,
    PermissionEnum,
    VerticalEnumSchema
} from '@repo/schemas';
import { previewPermanentGrantRevocation, revokePermanentGrant } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { buildPermanentGrantPorts } from './ports.js';
import { answerRejection } from './rejections.js';

/** Preview revocation on the act's path without writing anything. */
export const adminPermanentGrantRevocationPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{permanentGrantId}/revocation',
    summary: 'Preview revoking a permanent grant (ACC:2)',
    description:
        'Shows revocation effects without writing anything. The signed act reads the state again.',
    tags: ['Billing permanent grants', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: PermanentGrantRevocationParamsSchema.shape,
    responseSchema: PermanentGrantRevocationPreviewResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const { permanentGrantId } = PermanentGrantRevocationParamsSchema.parse(params);
        const actor = getActorFromContext(ctx);
        try {
            const result = await previewPermanentGrantRevocation({ actor, permanentGrantId });
            const response: PermanentGrantRevocationPreviewResponse = {
                ...result,
                verticalsLosingService: result.verticalsLosingService.map((vertical) =>
                    VerticalEnumSchema.parse(vertical)
                ),
                addonsTurnedOff: result.addonsTurnedOff.map((row) => ({ ...row }))
            };
            return response;
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

/**
 * POST revoke a live grant. billing.grantComplimentary is the route scope; the
 * service decides the action permission, subject and system actor. The
 * beneficiary is left without grant and without subscription, the old debit is
 * not resumed, the addons the grant had converted to $0 are turned off and the
 * trial does not come back.
 */
export const adminRevokePermanentGrantRoute = createAdminRoute({
    method: 'post',
    path: '/{permanentGrantId}/revocation',
    summary: 'Revoke a permanent grant (ACC:2)',
    description:
        'Revokes a live permanent grant. billing.grantComplimentary is the route scope; the service decides the action permission, subject and system actor. The beneficiary keeps neither grant nor subscription, the old debit is not resumed, the addons the grant converted are turned off and the trial does not return.',
    tags: ['Billing permanent grants', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: PermanentGrantRevocationParamsSchema.shape,
    requestBody: PermanentGrantRevocationRequestSchema,
    responseSchema: PermanentGrantRevocationResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const { permanentGrantId } = PermanentGrantRevocationParamsSchema.parse(params);
        const { reason } = PermanentGrantRevocationRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await revokePermanentGrant(
                { actor, permanentGrantId, reason },
                buildPermanentGrantPorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'permanent_grant',
                resourceId: permanentGrantId,
                metadata: {
                    administrativeAction: 'ACC_2',
                    transition: 'GRANT_REVOKED',
                    reason,
                    revokedVerticals: result.revokedVerticals,
                    cancelledAddonInstanceIds: result.cancelledAddonInstanceIds,
                    addonProviderCalls: result.addonProviderCalls
                }
            });
            const response: PermanentGrantRevocationResponse = {
                ...result,
                revokedAt: result.revokedAt.toISOString(),
                anchorIds: [...result.anchorIds],
                revokedVerticals: result.revokedVerticals.map((vertical) =>
                    VerticalEnumSchema.parse(vertical)
                ),
                cancelledAddonInstanceIds: [...result.cancelledAddonInstanceIds],
                addonProviderCalls: result.addonProviderCalls.map((call) => ({ ...call }))
            };
            return response;
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

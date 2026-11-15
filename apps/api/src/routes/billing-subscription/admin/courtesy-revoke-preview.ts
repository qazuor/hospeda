import {
    AdminSubscriptionCourtesyRevokePreviewResponseSchema,
    AdminSubscriptionPauseParamsSchema,
    PermissionEnum
} from '@repo/schemas';
import { previewTemporaryCourtesyRevoke } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { buildPausePorts } from '../pause-ports';
import { answerPauseRejection, rejectPause } from '../pause-rejections';
import { readSubscription } from '../read-subscription';

/** Preview a live courtesy and the predicted S10 charge date. */
export const adminCourtesyRevokePreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/courtesy/revoke-preview',
    summary: 'Preview temporary courtesy revocation (ACC:1)',
    description:
        'Reads the live courtesy and predicts the next charge date without changing state.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: AdminSubscriptionPauseParamsSchema.shape,
    responseSchema: AdminSubscriptionCourtesyRevokePreviewResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const found = await readSubscription(subscriptionId);
            if (!found) rejectPause('SUBSCRIPTION_NOT_FOUND');
            if (found.subjectId?.toLowerCase() === actor.id.toLowerCase())
                rejectPause('ADMINISTRATIVE_ACTION_FORBIDDEN');
            const preview = await previewTemporaryCourtesyRevoke(
                { subscriptionId },
                buildPausePorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: { subjectId: found.subjectId }
            });
            return {
                ...preview,
                courtesy: preview.courtesy
                    ? { ...preview.courtesy, endsAt: preview.courtesy.endsAt.toISOString() }
                    : null,
                predictedNextChargeAt: preview.predictedNextChargeAt?.toISOString() ?? null
            };
        } catch (error) {
            return answerPauseRejection({ error, ctx });
        }
    }
});

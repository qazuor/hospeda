import { and, eq, getDb, isNull, subscriptionPauses } from '@repo/db';
import {
    AdminSubscriptionCourtesyRevokeRequestSchema,
    AdminSubscriptionCourtesyRevokeResponseSchema,
    AdminSubscriptionPauseParamsSchema,
    PermissionEnum
} from '@repo/schemas';
import { revokeTemporaryCourtesy } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { buildResumePorts } from '../pause-ports';
import { answerPauseRejection, rejectPause } from '../pause-rejections';
import { readSubscription } from '../read-subscription';

/** Revoke a live temporary courtesy through S10 after explicit admin confirmation. */
export const adminRevokeCourtesyRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/courtesy/revoke',
    summary: 'Revoke temporary courtesy (ACC:1)',
    description: 'Requires a confirmed PAUSED state and the complimentary billing permission.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: AdminSubscriptionPauseParamsSchema.shape,
    requestBody: AdminSubscriptionCourtesyRevokeRequestSchema,
    responseSchema: AdminSubscriptionCourtesyRevokeResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = AdminSubscriptionCourtesyRevokeRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const found = await readSubscription(subscriptionId);
            if (!found) rejectPause('SUBSCRIPTION_NOT_FOUND');
            if (found.subjectId?.toLowerCase() === actor.id.toLowerCase())
                rejectPause('ADMINISTRATIVE_ACTION_FORBIDDEN');
            if (found.row.status !== input.expectedStatus)
                rejectPause('ADMINISTRATIVE_ACTION_STATE_CHANGED');
            const [openPause] = await getDb()
                .select({ reason: subscriptionPauses.reason })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, subscriptionId),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                )
                .limit(1);
            if (openPause?.reason !== 'COURTESY') rejectPause('COURTESY_NOT_IN_FORCE');
            const result = await revokeTemporaryCourtesy({ subscriptionId }, buildResumePorts());
            if (result.outcome === 'NOT_APPLICABLE') rejectPause('COURTESY_NOT_IN_FORCE');
            if (result.outcome === 'NOT_APPLIED') rejectPause('RESUME_NOT_APPLIED');
            if (result.outcome !== 'RESUMED') rejectPause(result.outcome);
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_1',
                    act: 'REVOKE_COURTESY',
                    outcome: result.outcome,
                    subjectId: found.subjectId,
                    courtesyGrantId: result.courtesyGrantId,
                    nextChargeAt: result.nextChargeAt?.toISOString() ?? null,
                    ...(input.note ? { note: input.note } : {})
                }
            });
            return {
                outcome: result.outcome,
                nextCharge: result.nextCharge
                    ? { ...result.nextCharge, at: result.nextCharge.at.toISOString() }
                    : null
            };
        } catch (error) {
            return answerPauseRejection({ error, ctx });
        }
    }
});

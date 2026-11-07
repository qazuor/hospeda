import { and, eq, getDb, isNull, subscriptionPauses } from '@repo/db';
import {
    PermissionEnum,
    SelfSubscriptionPauseParamsSchema,
    SelfSubscriptionPausePreviewResponseSchema,
    SelfSubscriptionPauseRequestSchema,
    SelfSubscriptionPauseResponseSchema,
    SelfSubscriptionResumeRequestSchema,
    SelfSubscriptionResumeResponseSchema
} from '@repo/schemas';
import {
    entityNotFoundError,
    pauseSubscription,
    previewPause,
    resumeSubscription
} from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createProtectedRoute } from '../../utils/route-factory';
import { buildPausePorts, buildResumePorts } from './pause-ports';
import { answerPauseRejection, rejectPause } from './pause-rejections';
import { readSubscription } from './read-subscription';

async function owned(subscriptionId: string, actorId: string): Promise<void> {
    const found = await readSubscription(subscriptionId);
    if (!found || found.subjectId !== actorId)
        throw entityNotFoundError({ entityName: 'Subscription' });
}

/** Explain the owner pause before confirmation. */
export const protectedPausePreviewRoute = createProtectedRoute({
    method: 'get',
    path: '/{subscriptionId}/pause-preview',
    summary: 'Preview own subscription pause',
    tags: ['Billing subscriptions'],
    description: 'Reads eligibility, dates and recurring addon effects before pausing.',
    emailUnverifiedOperation: 'READ_OWN',
    requiredPermissions: [PermissionEnum.BILLING_VIEW_OWN],
    requestParams: SelfSubscriptionPauseParamsSchema.shape,
    responseSchema: SelfSubscriptionPausePreviewResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const id = params.subscriptionId as string;
        await owned(id, actor.id);
        try {
            const preview = await previewPause(
                { subscriptionId: id, userId: actor.id },
                buildPausePorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'subscription',
                resourceId: id,
                metadata: { subjectId: actor.id }
            });
            return preview;
        } catch (error) {
            return answerPauseRejection({ error, ctx });
        }
    }
});

/** Execute an owner-requested pause. */
export const protectedPauseRoute = createProtectedRoute({
    method: 'post',
    path: '/{subscriptionId}/pause',
    summary: 'Pause own subscription',
    tags: ['Billing subscriptions'],
    description: 'Pauses an owned monthly card principal for the requested months.',
    requestParams: SelfSubscriptionPauseParamsSchema.shape,
    requestBody: SelfSubscriptionPauseRequestSchema,
    responseSchema: SelfSubscriptionPauseResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const id = params.subscriptionId as string;
        await owned(id, actor.id);
        const { months } = SelfSubscriptionPauseRequestSchema.parse(body);
        try {
            const result = await pauseSubscription(
                { subscriptionId: id, requestedMonths: months },
                buildPausePorts()
            );
            if (result.outcome === 'REFUSED') rejectPause(result.reason);
            if (result.outcome !== 'PAUSED') rejectPause(result.outcome);
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: id,
                metadata: { subjectId: actor.id, outcome: result.outcome }
            });
            return {
                outcome: result.outcome,
                pauseId: result.pauseId,
                expectedEndAt: result.expectedEndAt.toISOString(),
                complements: result.complements
            };
        } catch (error) {
            return answerPauseRejection({ error, ctx });
        }
    }
});

/** Execute an early owner-requested resume. */
export const protectedResumeRoute = createProtectedRoute({
    method: 'post',
    path: '/{subscriptionId}/resume',
    summary: 'Resume own subscription',
    tags: ['Billing subscriptions'],
    description: 'Resumes an owned customer-request pause early.',
    requestParams: SelfSubscriptionPauseParamsSchema.shape,
    requestBody: SelfSubscriptionResumeRequestSchema,
    responseSchema: SelfSubscriptionResumeResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        SelfSubscriptionResumeRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const id = params.subscriptionId as string;
        await owned(id, actor.id);
        try {
            const [openPause] = await getDb()
                .select({ reason: subscriptionPauses.reason })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, id),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                )
                .limit(1);
            if (!openPause) rejectPause('NO_OPEN_PAUSE');
            if (openPause.reason !== 'CUSTOMER_REQUEST') rejectPause('PAUSE_NOT_CUSTOMER_REQUEST');
            const result = await resumeSubscription(
                { subscriptionId: id, cause: 'EARLY' },
                buildResumePorts()
            );
            if (result.outcome === 'NOT_APPLICABLE') rejectPause(result.reason);
            if (result.outcome !== 'RESUMED') rejectPause(result.outcome);
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: id,
                metadata: { subjectId: actor.id, outcome: result.outcome }
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

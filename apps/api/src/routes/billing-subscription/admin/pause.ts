import { and, eq, getDb, isNull, subscriptionPauses } from '@repo/db';
import {
    AdminSubscriptionPauseParamsSchema,
    AdminSubscriptionPausePreviewResponseSchema,
    AdminSubscriptionPauseRequestSchema,
    AdminSubscriptionPauseResponseSchema,
    AdminSubscriptionResumeRequestSchema,
    AdminSubscriptionResumeResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import {
    PAUSE_LIMITS,
    pauseSubscription,
    previewPause,
    readPauseQuota,
    resumeSubscription
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { buildPausePorts, buildResumePorts } from '../pause-ports';
import { answerPauseRejection, rejectPause } from '../pause-rejections';
import { readSubscription } from '../read-subscription';

async function subjectFor(input: { readonly subscriptionId: string; readonly actorId: string }) {
    const found = await readSubscription(input.subscriptionId);
    if (!found) rejectPause('SUBSCRIPTION_NOT_FOUND');
    if (found.subjectId?.toLowerCase() === input.actorId.toLowerCase())
        rejectPause('ADMINISTRATIVE_ACTION_FORBIDDEN');
    return found;
}

/** Preview customer-request pause eligibility for administrative action 9. */
export const adminSubscriptionPausePreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/pause-preview',
    summary: 'Preview administrative subscription pause (ACC:9)',
    description:
        'Reads pause eligibility, quota and the open pause without changing billing state.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_PAUSE_SUBSCRIPTION],
    requestParams: AdminSubscriptionPauseParamsSchema.shape,
    responseSchema: AdminSubscriptionPausePreviewResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const found = await subjectFor({ subscriptionId, actorId: actor.id });
            const ports = buildPausePorts();
            const preview = await previewPause({ subscriptionId }, ports);
            const now = ports.clock.now();
            const quota =
                found.row.userId && found.row.vertical
                    ? await readPauseQuota({
                          tx: getDb(),
                          userId: found.row.userId,
                          vertical: found.row.vertical,
                          now
                      })
                    : { pausesInWindow: 0, monthsInWindow: 0 };
            const [openPause] = await getDb()
                .select({
                    reason: subscriptionPauses.reason,
                    expectedEndAt: subscriptionPauses.expectedEndAt
                })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, subscriptionId),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                )
                .limit(1);
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: { subjectId: found.subjectId }
            });
            return {
                subscriptionId,
                status: found.row.status,
                offered: preview.offered,
                ...(preview.offered
                    ? {
                          months: preview.months,
                          expectedEndAtByMonths: preview.expectedEndAtByMonths,
                          addons: preview.addons
                      }
                    : {
                          reason: preview.reason,
                          ...(preview.courtesyEndsAt
                              ? { courtesyEndsAt: preview.courtesyEndsAt }
                              : {})
                      }),
                quota: preview.offered
                    ? preview.quota
                    : {
                          pausesLeft: Math.max(
                              0,
                              PAUSE_LIMITS.maxPausesPerWindow - quota.pausesInWindow
                          ),
                          monthsLeft: Math.max(
                              0,
                              PAUSE_LIMITS.maxAccumulatedMonths - quota.monthsInWindow
                          )
                      },
                openPause: openPause
                    ? {
                          reason: openPause.reason,
                          expectedEndAt: openPause.expectedEndAt?.toISOString() ?? null
                      }
                    : null
            };
        } catch (error) {
            return answerPauseRejection({ error, ctx });
        }
    }
});

/** Execute confirmed customer-request pause on another customer's subscription. */
export const adminPauseSubscriptionRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/pause',
    summary: 'Pause a customer subscription (ACC:9)',
    description:
        'Requires explicit confirmation and the ACTIVE status observed by the administrator.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_PAUSE_SUBSCRIPTION],
    requestParams: AdminSubscriptionPauseParamsSchema.shape,
    requestBody: AdminSubscriptionPauseRequestSchema,
    responseSchema: AdminSubscriptionPauseResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = AdminSubscriptionPauseRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const found = await subjectFor({ subscriptionId, actorId: actor.id });
            if (found.row.status !== input.expectedStatus)
                rejectPause('ADMINISTRATIVE_ACTION_STATE_CHANGED');
            const result = await pauseSubscription(
                { subscriptionId, requestedMonths: input.months },
                buildPausePorts()
            );
            if (result.outcome === 'REFUSED') rejectPause(result.reason);
            if (result.outcome !== 'PAUSED') rejectPause(result.outcome);
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_9',
                    act: 'PAUSE',
                    outcome: result.outcome,
                    subjectId: found.subjectId,
                    months: input.months,
                    expectedEndAt: result.expectedEndAt.toISOString(),
                    ...(input.note ? { note: input.note } : {})
                }
            });
            return {
                subscriptionId,
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

/** Execute confirmed early return from a customer-request pause. */
export const adminResumeSubscriptionRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/resume',
    summary: 'Resume a customer subscription (ACC:9)',
    description:
        'Requires explicit confirmation and the PAUSED status observed by the administrator.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_PAUSE_SUBSCRIPTION],
    requestParams: AdminSubscriptionPauseParamsSchema.shape,
    requestBody: AdminSubscriptionResumeRequestSchema,
    responseSchema: AdminSubscriptionResumeResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = AdminSubscriptionResumeRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const found = await subjectFor({ subscriptionId, actorId: actor.id });
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
            if (!openPause) rejectPause('NO_OPEN_PAUSE');
            if (openPause.reason !== 'CUSTOMER_REQUEST') rejectPause('PAUSE_NOT_CUSTOMER_REQUEST');
            const result = await resumeSubscription(
                { subscriptionId, cause: 'EARLY' },
                buildResumePorts()
            );
            if (result.outcome === 'NOT_APPLICABLE') rejectPause(result.reason);
            if (result.outcome !== 'RESUMED') rejectPause(result.outcome);
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_9',
                    act: 'RESUME',
                    outcome: result.outcome,
                    subjectId: found.subjectId,
                    nextChargeAt: result.nextChargeAt?.toISOString() ?? null,
                    ...(input.note ? { note: input.note } : {})
                }
            });
            return {
                subscriptionId,
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

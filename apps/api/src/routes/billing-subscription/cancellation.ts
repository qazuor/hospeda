import { SUBSCRIPTION_STATUSES } from '@repo/db';
import {
    PermissionEnum,
    ServiceErrorCode,
    SubscriptionCancellationParamsSchema,
    SubscriptionCancellationPreviewResponseSchema,
    SubscriptionCancellationRequestSchema,
    SubscriptionCancellationResponseSchema
} from '@repo/schemas';
import {
    CANCEL_ACTIVE_REJECTIONS,
    type CancelActiveSubscriptionResult,
    type CancelDirectSubscriptionResult,
    cancelActiveSubscription,
    cancelDirectSubscription,
    entityNotFoundError,
    previewSubscriptionCancellation,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { buildSelfCancellationPorts } from './cancellation-ports';
import { readSubscription } from './read-subscription';

type Rejection = (typeof CANCEL_ACTIVE_REJECTIONS)[number];
const rejectionAnswer: Readonly<
    Record<Rejection, { status: 403 | 404 | 409; code: ServiceErrorCode }>
> = {
    SUBSCRIPTION_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    CANCELLATION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    CANCELLATION_NOT_PRINCIPAL: { status: 409, code: ServiceErrorCode.ALREADY_EXISTS },
    CANCELLATION_STATE_NOT_ALLOWED: { status: 409, code: ServiceErrorCode.ALREADY_EXISTS }
};
function isRejection(reason: string | undefined): reason is Rejection {
    return reason !== undefined && (CANCEL_ACTIVE_REJECTIONS as readonly string[]).includes(reason);
}
function isSubscriptionStatus(status: string): status is (typeof SUBSCRIPTION_STATUSES)[number] {
    return (SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}
function answer(error: unknown, ctx: Context): never | Response {
    if (error instanceof ServiceError && isRejection(error.reason)) {
        const mapped = rejectionAnswer[error.reason];
        return createErrorResponse(
            { code: mapped.code, message: error.message, reason: error.reason },
            ctx,
            mapped.status
        );
    }
    throw error;
}
async function owned(subscriptionId: string, actorId: string) {
    const found = await readSubscription(subscriptionId);
    if (!found || found.subjectId !== actorId)
        throw entityNotFoundError({ entityName: 'Subscription' });
    return found.row;
}

/** Read the exact effects of cancelling an owned subscription. */
export const protectedCancellationPreviewRoute = createProtectedRoute({
    method: 'get',
    path: '/{subscriptionId}/cancellation-preview',
    summary: 'Preview own subscription cancellation',
    description: 'Previews service end and recurrent addon effects before cancellation.',
    tags: ['Billing subscriptions'],
    emailUnverifiedOperation: 'READ_OWN',
    requiredPermissions: [PermissionEnum.BILLING_VIEW_OWN],
    requestParams: SubscriptionCancellationParamsSchema.shape,
    responseSchema: SubscriptionCancellationPreviewResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const id = params.subscriptionId as string;
        await owned(id, actor.id);
        try {
            const preview = await previewSubscriptionCancellation(
                { actor, subscriptionId: id },
                {
                    clock: buildSelfCancellationPorts().clock,
                    complements: buildSelfCancellationPorts().complements
                }
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
            return answer(error, ctx);
        }
    }
});

/** Execute the owner-only self-service cancellation act. */
export const protectedCancelSubscriptionRoute = createProtectedRoute({
    method: 'post',
    path: '/{subscriptionId}/cancellation',
    summary: 'Cancel own subscription',
    description: 'Cancels the authenticated owner subscription at its state-specific service end.',
    tags: ['Billing subscriptions'],
    emailUnverifiedOperation: 'CLOSE_ACCOUNT',
    requestParams: SubscriptionCancellationParamsSchema.shape,
    requestBody: SubscriptionCancellationRequestSchema,
    requestBodyRequired: false,
    responseSchema: SubscriptionCancellationResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        const { reason } = SubscriptionCancellationRequestSchema.parse(body ?? {});
        const actor = getActorFromContext(ctx);
        const id = params.subscriptionId as string;
        const current = await owned(id, actor.id);
        const ports = buildSelfCancellationPorts();
        try {
            const rejectState = () => {
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Subscription state cannot be cancelled',
                    undefined,
                    'CANCELLATION_STATE_NOT_ALLOWED'
                );
            };
            const byStatus: Record<
                (typeof SUBSCRIPTION_STATUSES)[number],
                () => Promise<CancelActiveSubscriptionResult | CancelDirectSubscriptionResult>
            > = {
                PENDING_AUTHORIZATION: rejectState,
                ABANDONED: rejectState,
                ACTIVE: () =>
                    cancelActiveSubscription({ actor, subscriptionId: id, reason }, ports),
                CANCEL_SCHEDULED: () =>
                    cancelActiveSubscription({ actor, subscriptionId: id, reason }, ports),
                SUSPENDED: () =>
                    cancelDirectSubscription({ actor, subscriptionId: id, reason }, ports),
                GRACE_PERIOD: () =>
                    cancelDirectSubscription({ actor, subscriptionId: id, reason }, ports),
                CANCELLED: () =>
                    cancelDirectSubscription({ actor, subscriptionId: id, reason }, ports),
                PAUSED: rejectState,
                CHARGE_DECLINED: rejectState
            };
            if (!isSubscriptionStatus(current.status)) {
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Subscription state cannot be cancelled',
                    undefined,
                    'CANCELLATION_STATE_NOT_ALLOWED'
                );
            }
            const result = await byStatus[current.status]();
            const serviceEndsAt =
                'serviceEndsAt' in result ? result.serviceEndsAt : result.serviceEndedAt;
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: id,
                metadata: { subjectId: actor.id, outcome: result.outcome }
            });
            return {
                subscriptionId: id,
                outcome: result.outcome,
                serviceEndsAt: serviceEndsAt?.toISOString() ?? null
            };
        } catch (error) {
            return answer(error, ctx);
        }
    }
});

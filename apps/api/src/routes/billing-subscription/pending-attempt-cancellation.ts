import {
    PendingAttemptCancellationParamsSchema,
    PendingAttemptCancellationResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { cancelPendingAttempt, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { getClock } from '../../utils/clock';
import { getPaymentProvider } from '../../utils/payment-provider';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { beforeCancelNotice } from './before-cancel-notice';

/** Cancel the authenticated person's pending signup attempt. */
export const protectedPendingAttemptCancellationRoute = createProtectedRoute({
    method: 'post',
    path: '/{subscriptionId}/pending-attempt-cancellation',
    summary: 'Cancel own pending signup attempt',
    description:
        'Abandons the caller’s pending signup attempt and releases its vertical commitment.',
    tags: ['Billing subscriptions'],
    requestParams: PendingAttemptCancellationParamsSchema.shape,
    responseSchema: PendingAttemptCancellationResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const result = await cancelPendingAttempt(
                { subscriptionId, userId: actor.id },
                {
                    provider: getPaymentProvider(),
                    clock: getClock().clock,
                    beforeCancelNotice
                }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: { subjectId: actor.id, outcome: result.outcome }
            });
            return result;
        } catch (error) {
            if (
                error instanceof ServiceError &&
                (error.reason === 'COMMITMENT_TAKEN' ||
                    error.reason === 'PREVIOUS_ATTEMPT_IN_PROGRESS')
            ) {
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.ALREADY_EXISTS,
                        message: error.message,
                        reason: error.reason
                    },
                    ctx,
                    409
                );
            }
            if (error instanceof ServiceError && error.code === ServiceErrorCode.NOT_FOUND) {
                return createErrorResponse(
                    { code: ServiceErrorCode.NOT_FOUND, message: error.message },
                    ctx,
                    404
                );
            }
            throw error;
        }
    }
});

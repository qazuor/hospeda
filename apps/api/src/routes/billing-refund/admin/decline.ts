import {
    PermissionEnum,
    RefundDeclineParamsSchema,
    RefundDeclineRequestSchema,
    RefundDeclineResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import {
    DECLINE_REFUND_REJECTIONS,
    type DeclineRefundRejection,
    declineRefund,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

type RejectionAnswer = {
    readonly status: 403 | 404 | 409;
    readonly code: ServiceErrorCode;
};

const NOT_FOUND: RejectionAnswer = { status: 404, code: ServiceErrorCode.NOT_FOUND };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };

/** Every RF5 decline rejection has an explicit HTTP response. */
const REJECTION_ANSWERS: Readonly<Record<DeclineRefundRejection, RejectionAnswer>> = {
    REFUND_NOT_FOUND: NOT_FOUND,
    REFUND_SOURCE_NOT_FOUND: NOT_FOUND,
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    REFUND_NOT_OPEN: CONFLICT,
    REFUND_STATE_CHANGED: CONFLICT,
    REFUND_HAS_PROVIDER_CALLS: CONFLICT
};

function isDeclineRefundRejection(reason: string | undefined): reason is DeclineRefundRejection {
    return (
        reason !== undefined && (DECLINE_REFUND_REJECTIONS as readonly string[]).includes(reason)
    );
}

/** POST /api/v1/admin/billing-refunds/{refundId}/decline — action 13 refusal (RF5). */
export const adminDeclineRefundRoute = createAdminRoute({
    method: 'post',
    path: '/{refundId}/decline',
    summary: 'Decline an open refund (ACC:13, RF5)',
    description: 'Records a human refusal of an open refund without changing its payment.',
    tags: ['Billing refunds', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REFUND],
    requestParams: RefundDeclineParamsSchema.shape,
    requestBody: RefundDeclineRequestSchema,
    responseSchema: RefundDeclineResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        RefundDeclineRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await declineRefund(
                { actor, refundId: String(params.refundId) },
                { clock: getClock().clock }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'refund',
                resourceId: result.refundId,
                metadata: {
                    administrativeAction: 'ACC_13',
                    transition: 'RF5',
                    subjectId: result.subjectId
                }
            });
            return { refundId: result.refundId, status: result.status };
        } catch (error) {
            if (error instanceof ServiceError && isDeclineRefundRejection(error.reason)) {
                const answer = REJECTION_ANSWERS[error.reason];
                return createErrorResponse(
                    { code: answer.code, message: error.message, reason: error.reason },
                    ctx,
                    answer.status
                );
            }
            throw error;
        }
    }
});

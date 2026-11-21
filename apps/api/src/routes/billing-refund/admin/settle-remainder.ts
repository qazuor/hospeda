import {
    PermissionEnum,
    RefundRemainderSettlementParamsSchema,
    RefundRemainderSettlementRequestSchema,
    type RefundRemainderSettlementResponse,
    RefundRemainderSettlementResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import {
    SETTLE_REFUND_REMAINDER_REJECTIONS,
    ServiceError,
    type SettleRefundRemainderRejection,
    settleRefundRemainder
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { getPaymentProvider } from '../../../utils/payment-provider';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

/** The HTTP answer of one typed rejection (error-contract «Action 14 remainder settlement»). */
type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const UNPROCESSABLE: RejectionAnswer = { status: 422, code: ServiceErrorCode.VALIDATION_ERROR };
const NOT_FOUND: RejectionAnswer = { status: 404, code: ServiceErrorCode.NOT_FOUND };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };

/**
 * Every rejection of `settleRefundRemainder`, mapped exhaustively: a new `reason` in the service
 * without an entry here breaks the typecheck.
 */
const REJECTION_ANSWERS: Readonly<Record<SettleRefundRemainderRejection, RejectionAnswer>> = {
    REFUND_AMOUNT_INVALID: UNPROCESSABLE,
    EXTERNAL_REFERENCE_INVALID: UNPROCESSABLE,
    REMAINDER_AMOUNT_MISMATCH: UNPROCESSABLE,
    REMAINDER_NOT_FOUND_AT_PROVIDER: UNPROCESSABLE,
    REFUND_NOT_FOUND: NOT_FOUND,
    REFUND_SOURCE_NOT_FOUND: NOT_FOUND,
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    REFUND_NOT_CONFIRMED: CONFLICT,
    REFUND_CALL_UNANSWERED: CONFLICT,
    OTHER_REFUND_CALL_UNANSWERED: CONFLICT,
    REFUND_HAS_NO_ACCEPTED_CALL: CONFLICT,
    EXTERNAL_REFERENCE_ALREADY_SETTLED: CONFLICT,
    ACCEPTED_PART_NOT_ACCREDITED: CONFLICT,
    REFUND_STATE_CHANGED: CONFLICT
};

function isRemainderRejection(
    reason: string | undefined
): reason is SettleRefundRemainderRejection {
    return (
        reason !== undefined &&
        (SETTLE_REFUND_REMAINDER_REJECTIONS as readonly string[]).includes(reason)
    );
}

/**
 * POST /api/v1/admin/billing-refunds/{refundId}/settle-remainder — administrative action 14 over a
 * `CONFIRMED` refund the provider accepted only in part (HOS-2406): a person records the remainder
 * they refunded by hand from the provider panel, and the refund closes `EXECUTED`.
 * `requiredPermissions` is only the route's early 403; step 3 (the action's own permission, the
 * payer as subject, the system actor) is decided by the service inside its transaction.
 */
export const adminSettleRefundRemainderRoute = createAdminRoute({
    method: 'post',
    path: '/{refundId}/settle-remainder',
    summary: 'Settle the remainder of a partially accepted refund (ACC:14, HOS-2406)',
    description:
        'Records the remainder of a CONFIRMED refund the provider accepted only in part, refunded by hand from the provider panel, and closes the refund EXECUTED. Requires billing.settleExternal; evaluated on the payer as subject.',
    tags: ['Billing refunds', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL],
    requestParams: RefundRemainderSettlementParamsSchema.shape,
    requestBody: RefundRemainderSettlementRequestSchema,
    responseSchema: RefundRemainderSettlementResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = RefundRemainderSettlementRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await settleRefundRemainder(
                {
                    actor,
                    refundId: String(params.refundId),
                    amount: input.amount,
                    reference: input.reference
                },
                { provider: getPaymentProvider(), clock: getClock().clock }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'refund',
                resourceId: result.refundId,
                metadata: {
                    administrativeAction: 'ACC_14',
                    transition: 'RF3',
                    settlement: 'PARTIAL_REFUND_REMAINDER',
                    subjectId: result.subjectId,
                    acceptedAmount: result.acceptedAmount,
                    amount: result.remainderAmount,
                    channel: 'PROVIDER_PANEL',
                    reference: input.reference,
                    paymentOutcome: result.paymentOutcome,
                    coverageReleased: result.coverageReleased,
                    ...(input.note ? { note: input.note } : {})
                }
            });
            const response: RefundRemainderSettlementResponse = {
                refundId: result.refundId,
                status: 'EXECUTED',
                acceptedAmount: result.acceptedAmount,
                remainderAmount: result.remainderAmount,
                paymentOutcome: result.paymentOutcome,
                coverageReleased: result.coverageReleased
            };
            return response;
        } catch (error) {
            if (error instanceof ServiceError && isRemainderRejection(error.reason)) {
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

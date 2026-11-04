import {
    PermissionEnum,
    RefundConfirmationParamsSchema,
    RefundConfirmationRequestSchema,
    RefundConfirmationResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import {
    CONFIRM_REFUND_REJECTIONS,
    type ConfirmRefundRejection,
    confirmRefund,
    createPaymentReconciliationMarkPayments,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { getPaymentProvider } from '../../../utils/payment-provider';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };
const NOT_FOUND: RejectionAnswer = { status: 404, code: ServiceErrorCode.NOT_FOUND };
const UNPROCESSABLE: RejectionAnswer = {
    status: 422,
    code: ServiceErrorCode.VALIDATION_ERROR
};

/** Every service rejection is answered explicitly; new reasons require an HTTP mapping. */
const REJECTION_ANSWERS: Readonly<Record<ConfirmRefundRejection, RejectionAnswer>> = {
    REFUND_NOT_FOUND: NOT_FOUND,
    REFUND_SOURCE_NOT_FOUND: NOT_FOUND,
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    REFUND_NOT_OPEN: CONFLICT,
    REFUND_STATE_CHANGED: CONFLICT,
    PAYMENT_NOT_REFUNDABLE: CONFLICT,
    REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE: CONFLICT,
    RETAINED_PAYMENT_SUCCESSION_OPEN: CONFLICT,
    REFUND_EXCEEDS_BALANCE: UNPROCESSABLE,
    REFUND_PAST_PROVIDER_WINDOW: UNPROCESSABLE,
    REFUND_PROVIDER_ID_ALREADY_RECORDED: CONFLICT
};

function isConfirmRefundRejection(reason: string | undefined): reason is ConfirmRefundRejection {
    return (
        reason !== undefined && (CONFIRM_REFUND_REJECTIONS as readonly string[]).includes(reason)
    );
}

/**
 * POST /api/v1/admin/billing-refunds/{refundId}/confirm — administrative action 13 (RF2).
 * `requiredPermissions` provides the early 403; the service makes the action decision
 * inside its transaction, against the payer as subject, before calling the provider.
 */
export const adminConfirmRefundRoute = createAdminRoute({
    method: 'post',
    path: '/{refundId}/confirm',
    summary: 'Confirm and send a refund (ACC:13, RF2)',
    description: 'Confirms a requested refund and sends it to the payment provider.',
    tags: ['Billing refunds', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REFUND],
    requestParams: RefundConfirmationParamsSchema.shape,
    requestBody: RefundConfirmationRequestSchema,
    responseSchema: RefundConfirmationResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        RefundConfirmationRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const clock = getClock().clock;
        try {
            const result = await confirmRefund(
                { actor, refundId: String(params.refundId) },
                {
                    clock,
                    provider: getPaymentProvider(),
                    markPayments: createPaymentReconciliationMarkPayments(clock)
                }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'refund',
                resourceId: result.refundId,
                metadata: {
                    administrativeAction: 'ACC_13',
                    transition: result.status === 'FAILED' ? 'RF5' : 'RF2',
                    subjectId: result.subjectId,
                    outcome: result.outcome,
                    calls: result.calls.length
                }
            });
            return {
                refundId: result.refundId,
                status: result.status,
                outcome: result.outcome,
                calls: result.calls
            };
        } catch (error) {
            if (error instanceof ServiceError && isConfirmRefundRejection(error.reason)) {
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

import {
    ExternalRefundSettlementRequestSchema,
    type ExternalRefundSettlementResponse,
    ExternalRefundSettlementResponseSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import {
    SETTLE_EXTERNAL_REFUND_REJECTIONS,
    ServiceError,
    type SettleExternalRefundInput,
    type SettleExternalRefundRejection,
    settleExternalRefund
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

/** The HTTP answer of one typed rejection of RF4 (error-contract «Action 14 rejections»). */
type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const UNPROCESSABLE: RejectionAnswer = { status: 422, code: ServiceErrorCode.VALIDATION_ERROR };
const NOT_FOUND: RejectionAnswer = { status: 404, code: ServiceErrorCode.NOT_FOUND };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };

/**
 * Every rejection of `settleExternalRefund`, mapped exhaustively: a new `reason`
 * in the service without an entry here breaks the typecheck.
 */
const REJECTION_ANSWERS: Readonly<Record<SettleExternalRefundRejection, RejectionAnswer>> = {
    REFUND_AMOUNT_INVALID: UNPROCESSABLE,
    EXTERNAL_REFERENCE_INVALID: UNPROCESSABLE,
    REFUND_EXCEEDS_BALANCE: UNPROCESSABLE,
    MANUAL_PAYMENT_SCOPE_REQUIRED: UNPROCESSABLE,
    MANUAL_PAYMENT_SCOPE_NOT_ALLOWED: UNPROCESSABLE,
    REFUND_SOURCE_NOT_FOUND: NOT_FOUND,
    REFUND_NOT_FOUND: NOT_FOUND,
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    PAYMENT_NOT_REFUNDABLE: CONFLICT,
    REQUESTED_AMOUNT_MISMATCH: CONFLICT,
    OPEN_REQUESTS_AMBIGUOUS: CONFLICT,
    REFUND_NOT_OPEN: CONFLICT,
    REFUND_STATE_CHANGED: CONFLICT,
    EXTERNAL_REFERENCE_ALREADY_SETTLED: CONFLICT
};

function isSettlementRejection(
    reason: string | undefined
): reason is SettleExternalRefundRejection {
    return (
        reason !== undefined &&
        (SETTLE_EXTERNAL_REFUND_REJECTIONS as readonly string[]).includes(reason)
    );
}

/**
 * POST /api/v1/admin/billing-refunds/external — administrative action 14 (ACC:14, RF4):
 * a person records a refund that already happened outside our flow (bank transfer or
 * provider panel), closing the open RF1 request when there is one (AC:B5:10, AC:B5:41).
 * `requiredPermissions` is only the route's early 403; the decision that counts (the
 * action's own permission, the payer as subject, the system actor) is taken by the
 * service inside its transaction. The route reads neither the payment nor the subject.
 */
export const adminSettleExternalRefundRoute = createAdminRoute({
    method: 'post',
    path: '/external',
    summary: 'Settle an out-of-flow refund (ACC:14, RF4)',
    description:
        'Administrative action 14: records a refund that already happened outside our flow (bank transfer or provider panel). Requires billing.settleExternal; evaluated on the payer as subject.',
    tags: ['Billing refunds', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL],
    requestBody: ExternalRefundSettlementRequestSchema,
    responseSchema: ExternalRefundSettlementResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = ExternalRefundSettlementRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const source: SettleExternalRefundInput['source'] = input.paymentId
            ? { kind: 'PAYMENT', id: input.paymentId }
            : { kind: 'MANUAL_PAYMENT', id: input.manualPaymentId as string };
        try {
            const result = await settleExternalRefund(
                {
                    actor,
                    source,
                    amount: input.amount,
                    channel: input.channel,
                    reference: input.reference,
                    reason: input.reason,
                    refundId: input.refundId,
                    onAmountMismatch: input.onAmountMismatch,
                    manualPaymentScope: input.manualPaymentScope
                },
                { clock: getClock().clock }
            );
            const closed = result.closedRequestedRefundId !== null;
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: closed ? 'update' : 'create',
                resourceType: 'refund',
                resourceId: result.refundId,
                metadata: {
                    administrativeAction: 'ACC_14',
                    transition: 'RF4',
                    subjectId: result.subjectId,
                    ...(source.kind === 'PAYMENT'
                        ? { paymentId: source.id }
                        : { manualPaymentId: source.id }),
                    amount: input.amount,
                    channel: input.channel,
                    reference: input.reference,
                    reason: input.reason,
                    closedRequestedRefundId: result.closedRequestedRefundId,
                    paymentOutcome: result.paymentOutcome,
                    coverageReleased: result.coverageReleased,
                    ...(input.note ? { note: input.note } : {})
                }
            });
            const response: ExternalRefundSettlementResponse = {
                refundId: result.refundId,
                status: 'EXECUTED',
                closedRequestedRefund: closed,
                paymentOutcome: result.paymentOutcome,
                coverageReleased: result.coverageReleased
            };
            return response;
        } catch (error) {
            if (error instanceof ServiceError && isSettlementRejection(error.reason)) {
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

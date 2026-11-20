import {
    PermissionEnum,
    RefundProviderCallRetryParamsSchema,
    RefundProviderCallRetryRequestSchema,
    type RefundProviderCallRetryResponse,
    RefundProviderCallRetryResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import {
    RETRY_REFUND_PROVIDER_CALLS_REJECTIONS,
    type RetryRefundProviderCallsRejection,
    retryRefundProviderCalls,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { getPaymentProvider } from '../../../utils/payment-provider';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

/** The HTTP answer of one typed rejection (error-contract «Action 13 provider call retry»). */
type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const NOT_FOUND: RejectionAnswer = { status: 404, code: ServiceErrorCode.NOT_FOUND };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };

/**
 * Every rejection of `retryRefundProviderCalls`, mapped exhaustively: a new `reason` in the service
 * without an entry here breaks the typecheck.
 */
const REJECTION_ANSWERS: Readonly<Record<RetryRefundProviderCallsRejection, RejectionAnswer>> = {
    REFUND_NOT_FOUND: NOT_FOUND,
    REFUND_SOURCE_NOT_FOUND: NOT_FOUND,
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    REFUND_NOT_CONFIRMED: CONFLICT,
    REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE: CONFLICT,
    REFUND_HAS_NO_UNANSWERED_CALL: CONFLICT,
    REFUND_PAST_PROVIDER_WINDOW: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    REFUND_STATE_CHANGED: CONFLICT
};

function isRetryRejection(reason: string | undefined): reason is RetryRefundProviderCallsRejection {
    return (
        reason !== undefined &&
        (RETRY_REFUND_PROVIDER_CALLS_REJECTIONS as readonly string[]).includes(reason)
    );
}

/** The transition the audit names: RF5 when a resent call was rejected, else the RF2 resend (and RF3 when it closed). */
function auditedTransition(result: RefundProviderCallRetryResponse): 'RF2' | 'RF3' | 'RF5' {
    if (result.status === 'FAILED') return 'RF5';
    return result.status === 'EXECUTED' ? 'RF3' : 'RF2';
}

/**
 * POST /api/v1/admin/billing-refunds/{refundId}/retry-provider-calls — «Retry with MP» (HOS-2516):
 * resends, under their original idempotency keys, the provider calls of a `CONFIRMED` refund that
 * went unanswered, then runs RF3 when every one came back accepted. It continues administrative
 * action 13, so `requiredPermissions` is that action's early 403; step 3 (the payer as subject,
 * the system actor) is decided by the service before any provider call.
 */
export const adminRetryRefundProviderCallsRoute = createAdminRoute({
    method: 'post',
    path: '/{refundId}/retry-provider-calls',
    summary: 'Retry the unanswered provider calls of a confirmed refund (ACC:13, HOS-2516)',
    description:
        'Resends to the payment provider, with the same idempotency key, every call of a CONFIRMED refund the provider left unanswered, then re-reads the charge (RF3). Requires billing.refund; evaluated on the payer as subject.',
    tags: ['Billing refunds', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REFUND],
    requestParams: RefundProviderCallRetryParamsSchema.shape,
    requestBody: RefundProviderCallRetryRequestSchema,
    responseSchema: RefundProviderCallRetryResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        RefundProviderCallRetryRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await retryRefundProviderCalls(
                { actor, refundId: String(params.refundId) },
                { provider: getPaymentProvider(), clock: getClock().clock }
            );
            const response: RefundProviderCallRetryResponse = {
                refundId: result.refundId,
                status: result.status,
                calls: result.calls.map(({ idempotencyKey, outcome }) => ({
                    idempotencyKey,
                    outcome
                })),
                execution: result.execution
            };
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'refund',
                resourceId: result.refundId,
                metadata: {
                    administrativeAction: 'ACC_13',
                    operation: 'RETRY_PROVIDER_CALLS',
                    transition: auditedTransition(response),
                    subjectId: result.subjectId,
                    status: result.status,
                    calls: result.calls,
                    execution: result.execution
                }
            });
            return response;
        } catch (error) {
            if (error instanceof ServiceError && isRetryRejection(error.reason)) {
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

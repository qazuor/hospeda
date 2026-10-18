import {
    PermissionEnum,
    ReconciliationMarkLiftRequestSchema,
    type ReconciliationMarkLiftResponse,
    ReconciliationMarkLiftResponseSchema,
    ReconciliationMarkParamsSchema,
    ServiceErrorCode
} from '@repo/schemas';
import {
    LIFT_RECONCILIATION_MARK_REJECTIONS,
    type LiftReconciliationMarkRejection,
    liftReconciliationMarkByAdmin,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

type RejectionAnswer = { readonly status: 403 | 404 | 409 | 422; readonly code: ServiceErrorCode };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };
const ROUTE_REJECTIONS: readonly string[] = LIFT_RECONCILIATION_MARK_REJECTIONS;
const REJECTION_ANSWERS: Readonly<Record<LiftReconciliationMarkRejection, RejectionAnswer>> = {
    MARK_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    MARK_ALREADY_LIFTED: CONFLICT,
    MARK_VERSION_CONFLICT: CONFLICT,
    MARK_HAS_UNRESOLVED_PAYMENTS: CONFLICT,
    MARK_PAYMENT_NOT_HUNG: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR }
};

function isLiftRejection(reason: string | undefined): reason is LiftReconciliationMarkRejection {
    return reason !== undefined && ROUTE_REJECTIONS.includes(reason);
}

/**
 * ACC:7 (S15) lifts one reconciliation mark and resolves only the explicitly named hung payments.
 * `requiredPermissions` is only the early 403; action permission, subject, system actor and actor=subject
 * are decided by the service in its transaction. It never refunds money or changes row status (DEC-RF-002).
 */
export const adminLiftReconciliationMarkRoute = createAdminRoute({
    method: 'post',
    path: '/marks/{markId}/lift',
    summary: 'Lift one reconciliation mark (ACC:7, S15)',
    description:
        'Administrative action 7: lifts one open reconciliation mark (S15) at the version the person read, resolving without refund only the hung payments the request names. Requires billing.liftReconciliationMark; evaluated on the owner of the mark row as subject.',
    tags: ['Billing reconciliation', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK],
    requestParams: ReconciliationMarkParamsSchema.shape,
    requestBody: ReconciliationMarkLiftRequestSchema,
    responseSchema: ReconciliationMarkLiftResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = ReconciliationMarkLiftRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await liftReconciliationMarkByAdmin(
                {
                    actor,
                    markId: String(params.markId),
                    expectedVersion: input.expectedVersion,
                    resolveWithoutRefund: input.resolveWithoutRefund.map(
                        ({ source, paymentId }) => ({
                            source,
                            id: paymentId
                        })
                    )
                },
                { clock: getClock().clock }
            );
            const resolvedWithoutRefund = result.resolvedWithoutRefund.map(({ source, id }) => ({
                source,
                paymentId: id
            }));
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'reconciliation_mark',
                resourceId: result.markId,
                metadata: {
                    administrativeAction: 'ACC_7',
                    transition: 'S15',
                    reason: result.reason,
                    subjectId: result.subjectId,
                    expectedVersion: input.expectedVersion,
                    version: result.version,
                    resolvedWithoutRefund,
                    ...(input.note ? { note: input.note } : {})
                }
            });
            const response: ReconciliationMarkLiftResponse = {
                markId: result.markId,
                reason: result.reason,
                liftedAt: result.liftedAt.toISOString(),
                liftedBy: result.liftedBy,
                version: result.version,
                resolvedWithoutRefund
            };
            return response;
        } catch (error) {
            if (error instanceof ServiceError && isLiftRejection(error.reason)) {
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

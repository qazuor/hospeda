import {
    ExternalChargeSettlementRequestSchema,
    type ExternalChargeSettlementResponse,
    ExternalChargeSettlementResponseSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import {
    SETTLE_EXTERNAL_CHARGE_REJECTIONS,
    ServiceError,
    type SettleExternalChargeRejection,
    settleExternalCharge
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { buildMercadoPagoNoticePorts } from '../../webhooks/mercadopago-ports';

type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const NOT_FOUND: RejectionAnswer = { status: 404, code: ServiceErrorCode.NOT_FOUND };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };

const REJECTION_ANSWERS: Readonly<Record<SettleExternalChargeRejection, RejectionAnswer>> = {
    CHARGE_NOT_FOUND: NOT_FOUND,
    CHARGE_NOT_LINKED: NOT_FOUND,
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    CHARGE_NOT_SETTLEABLE: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    CHARGE_NOT_APPROVED: CONFLICT,
    CHARGE_ALREADY_RECORDED: CONFLICT
};

const ROUTE_REJECTIONS: readonly string[] = SETTLE_EXTERNAL_CHARGE_REJECTIONS;

function isSettlementRejection(
    reason: string | undefined
): reason is SettleExternalChargeRejection {
    return reason !== undefined && ROUTE_REJECTIONS.includes(reason);
}

/**
 * Settles motive 19 through ACC:14 (AC:B5:11). The receiving rule belongs to the receiver.
 * `requiredPermissions` supplies only the early 403; the service makes the authorization decision
 * that counts. This route reads neither the subscription nor the provider charge.
 */
export const adminSettleExternalChargeRoute = createAdminRoute({
    method: 'post',
    path: '/external-charge',
    summary: 'Settle an unrecorded provider charge (ACC:14, motive 19)',
    description:
        'Administrative action 14 settles an approved provider charge that was never recorded.',
    tags: ['Billing refunds', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL],
    requestBody: ExternalChargeSettlementRequestSchema,
    responseSchema: ExternalChargeSettlementResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = ExternalChargeSettlementRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await settleExternalCharge(
                { actor, chargeId: input.chargeId },
                buildMercadoPagoNoticePorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'payment',
                resourceId: result.paymentId,
                metadata: {
                    administrativeAction: 'ACC_14',
                    transition: 'P1',
                    motive: 'COBRO_SIN_REGISTRAR',
                    subjectId: result.subjectId,
                    chargeId: input.chargeId,
                    reception: result.reception,
                    coverage: result.coverage,
                    ...(input.note ? { note: input.note } : {})
                }
            });
            const paymentStatusByCredit: Record<typeof result.credit, 'SUCCEEDED'> = {
                CREDITED: 'SUCCEEDED'
            };
            const response: ExternalChargeSettlementResponse = {
                paymentId: result.paymentId,
                paymentStatus: paymentStatusByCredit[result.credit],
                coverage: result.coverage,
                reception: result.reception
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

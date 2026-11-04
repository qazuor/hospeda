import {
    LateManualPaymentBodySchema,
    LateManualPaymentPreviewResponseSchema,
    LateManualPaymentResponseSchema,
    ManualPaymentListParamsSchema,
    ManualPaymentParamsSchema,
    PermissionEnum,
    ServiceErrorCode,
    UnallocatedManualPaymentBodySchema,
    UnallocatedManualPaymentPreviewResponseSchema,
    UnallocatedManualPaymentResponseSchema
} from '@repo/schemas';
import {
    previewLateManualPaymentRegistration,
    previewUnallocatedManualPayment,
    REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS,
    REGISTER_UNALLOCATED_MANUAL_PAYMENT_REJECTIONS,
    type RegisterLateManualPaymentRejection,
    registerLateManualPayment,
    registerUnallocatedManualPayment,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { getAnalyticsFactSink } from '../../../utils/analytics/analytics-facts';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { buildComplementPolicyPorts } from '../../../utils/billing-complement-ports';
import { getClock } from '../../../utils/clock';
import { getCoverageNotices } from '../../../utils/listing-access/coverage-notices';
import { getPaymentProvider } from '../../../utils/payment-provider';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { beforeCancelNotice } from '../before-cancel-notice';
import { readSubscription } from '../read-subscription';
import { touristVipInheritance } from '../tourist-vip-inheritance';

type Rejection =
    | RegisterLateManualPaymentRejection
    | (typeof REGISTER_UNALLOCATED_MANUAL_PAYMENT_REJECTIONS)[number];
type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};
const NOT_FOUND: RejectionAnswer = { status: 404, code: ServiceErrorCode.NOT_FOUND };
const FORBIDDEN: RejectionAnswer = { status: 403, code: ServiceErrorCode.FORBIDDEN };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };
const INVALID: RejectionAnswer = { status: 422, code: ServiceErrorCode.VALIDATION_ERROR };

/** Exhaustive HTTP answers for MP4 and MP6 service rejections. */
const REJECTION_ANSWERS: Readonly<Record<Rejection, RejectionAnswer>> = {
    SUBSCRIPTION_NOT_FOUND: NOT_FOUND,
    MANUAL_PAYMENT_NOT_FOUND: NOT_FOUND,
    ADMINISTRATIVE_ACTION_FORBIDDEN: FORBIDDEN,
    MANUAL_PAYMENT_NOT_MANUAL: INVALID,
    MANUAL_PAYMENT_NOT_DECLARED_UNPAID: CONFLICT,
    MANUAL_PAYMENT_NOT_SUSPENDED: CONFLICT,
    MANUAL_PAYMENT_CONDITION_FAILED: INVALID,
    MANUAL_PAYMENT_COVERAGE_CONFLICT: CONFLICT,
    RETAINED_PAYMENT: CONFLICT,
    LOST_RACE: CONFLICT,
    MANUAL_PAYMENT_NO_PERIOD: INVALID,
    MANUAL_PAYMENT_OPEN_INSTALLMENT: CONFLICT,
    MANUAL_PAYMENT_PERIOD_NOT_COVERED: INVALID,
    MANUAL_PAYMENT_NOT_ALLOCATABLE: INVALID
};

function isRejection(reason: string | undefined): reason is Rejection {
    const reasons: readonly string[] = [
        ...REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS,
        ...REGISTER_UNALLOCATED_MANUAL_PAYMENT_REJECTIONS
    ];
    return reason !== undefined && reasons.includes(reason);
}

function answerRejection(input: { readonly error: unknown; readonly ctx: Context }) {
    const { error, ctx } = input;
    if (error instanceof ServiceError && isRejection(error.reason)) {
        const answer = REJECTION_ANSWERS[error.reason];
        return createErrorResponse(
            { code: answer.code, message: error.message, reason: error.reason },
            ctx,
            answer.status
        );
    }
    throw error;
}

async function auditSubjectOf(subscriptionId: string): Promise<string | null> {
    try {
        return (await readSubscription(subscriptionId))?.subjectId ?? null;
    } catch {
        return null;
    }
}

/** Read-only confirmation of administrative action 3 through MP4. */
export const adminLateManualPaymentPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/manual-payments/{manualPaymentId}/register-late',
    summary: 'Preview late manual payment registration',
    description: 'Confirm the MP4 effect and possible period reimputation.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT],
    requestParams: ManualPaymentParamsSchema.shape,
    responseSchema: LateManualPaymentPreviewResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        try {
            const preview = await previewLateManualPaymentRegistration({
                actor,
                subscriptionId: params.subscriptionId as string,
                manualPaymentId: params.manualPaymentId as string
            });
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'subscription',
                resourceId: preview.subscriptionId,
                metadata: { subjectId: await auditSubjectOf(preview.subscriptionId) }
            });
            return {
                ...preview,
                periodStart: preview.periodStart.toISOString(),
                reimputedPeriodStart: preview.reimputedPeriodStart?.toISOString() ?? null,
                nextChargeAt: preview.nextChargeAt.toISOString()
            };
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

/** Registers a declared unpaid installment through MP4. */
export const adminRegisterLateManualPaymentRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/manual-payments/{manualPaymentId}/register-late',
    summary: 'Register a late manual payment',
    description: 'Perform administrative action 3 (MP4).',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT],
    requestParams: ManualPaymentParamsSchema.shape,
    requestBody: LateManualPaymentBodySchema,
    responseSchema: LateManualPaymentResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = LateManualPaymentBodySchema.parse(body);
        const subscriptionId = params.subscriptionId as string;
        try {
            const clock = getClock().clock;
            const coverageNotices = getCoverageNotices();
            const billingFacts = getAnalyticsFactSink();
            const result = await registerLateManualPayment(
                {
                    actor,
                    subscriptionId,
                    manualPaymentId: params.manualPaymentId as string,
                    ...input
                },
                {
                    clock,
                    coverageNotices,
                    billingFacts,
                    complementPorts: {
                        provider: getPaymentProvider(),
                        beforeCancelNotice,
                        touristVipInheritance,
                        complements: buildComplementPolicyPorts()
                    }
                }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_3',
                    effect: result.effect,
                    reimputedFrom: result.reimputedFrom?.toISOString() ?? null,
                    periodStart: result.periodStart.toISOString(),
                    subjectId: await auditSubjectOf(subscriptionId)
                }
            });
            return {
                ...result,
                nextChargeAt: result.nextChargeAt.toISOString(),
                periodStart: result.periodStart.toISOString(),
                reimputedFrom: result.reimputedFrom?.toISOString() ?? null
            };
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

/** Read-only confirmation of administrative action 3 through MP6. */
export const adminUnallocatedManualPaymentPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/manual-payments/unallocated',
    summary: 'Preview an unallocated manual transfer',
    description: 'Confirm the MP6 reconciliation mark before registration.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT],
    requestParams: ManualPaymentListParamsSchema.shape,
    responseSchema: UnallocatedManualPaymentPreviewResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        try {
            const preview = await previewUnallocatedManualPayment({
                actor,
                subscriptionId: params.subscriptionId as string
            });
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'subscription',
                resourceId: preview.subscriptionId,
                metadata: { subjectId: await auditSubjectOf(preview.subscriptionId) }
            });
            return { ...preview, periodStart: preview.periodStart.toISOString() };
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

/** Registers an unallocated transfer and opens its MP6 mark. */
export const adminRegisterUnallocatedManualPaymentRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/manual-payments/unallocated',
    summary: 'Register an unallocated manual transfer',
    description: 'Perform administrative action 3 (MP6).',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT],
    requestParams: ManualPaymentListParamsSchema.shape,
    requestBody: UnallocatedManualPaymentBodySchema,
    responseSchema: UnallocatedManualPaymentResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = UnallocatedManualPaymentBodySchema.parse(body);
        const subscriptionId = params.subscriptionId as string;
        try {
            const result = await registerUnallocatedManualPayment(
                { actor, subscriptionId, ...input },
                { clock: getClock().clock }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_3',
                    mark: result.mark,
                    manualPaymentId: result.manualPaymentId,
                    subjectId: await auditSubjectOf(subscriptionId)
                }
            });
            return { ...result, periodStart: result.periodStart.toISOString() };
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

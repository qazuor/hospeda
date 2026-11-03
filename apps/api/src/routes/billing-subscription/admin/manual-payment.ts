import { eq, getDb, manualPayments, planCatalogModel } from '@repo/db';
import {
    ManualPaymentListParamsSchema,
    ManualPaymentListResponseSchema,
    ManualPaymentParamsSchema,
    ManualPaymentRegistrationBodySchema,
    ManualPaymentRegistrationPreviewResponseSchema,
    ManualPaymentRegistrationResponseSchema,
    ManualUnpaidPreviewResponseSchema,
    ManualUnpaidResponseSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import {
    afterSubscriptionActivated,
    DECLARE_MANUAL_UNPAID_REJECTIONS,
    type DeclareManualUnpaidRejection,
    declareManualPaymentUnpaid,
    previewManualPaymentRegistration,
    previewManualUnpaidDeclaration,
    REGISTER_MANUAL_PAYMENT_REJECTIONS,
    type RegisterManualPaymentRejection,
    registerManualPayment,
    ServiceError
} from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { getAnalyticsFactSink } from '../../../utils/analytics/analytics-facts';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { getCoverageNotices } from '../../../utils/listing-access/coverage-notices';
import { getPaymentProvider } from '../../../utils/payment-provider';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { beforeCancelNotice } from '../before-cancel-notice';
import { readSubscription } from '../read-subscription';
import { touristVipInheritance } from '../tourist-vip-inheritance';

type Rejection = RegisterManualPaymentRejection | DeclareManualUnpaidRejection;
type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };
const INVALID: RejectionAnswer = { status: 422, code: ServiceErrorCode.VALIDATION_ERROR };

/** Exhaustive HTTP answers for the typed MP1 and MP2 rejections. */
const REJECTION_ANSWERS: Readonly<Record<Rejection, RejectionAnswer>> = {
    SUBSCRIPTION_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    MANUAL_PAYMENT_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    MANUAL_PAYMENT_NOT_MANUAL: INVALID,
    MANUAL_PAYMENT_NOT_AWAITING: CONFLICT,
    MANUAL_PAYMENT_NOT_IN_GRACE: CONFLICT,
    MANUAL_PAYMENT_STATE_NOT_ALLOWED: CONFLICT,
    MANUAL_PAYMENT_CONDITION_FAILED: INVALID,
    MANUAL_PAYMENT_COVERAGE_CONFLICT: CONFLICT,
    SUCCESSION_IN_PROGRESS: CONFLICT,
    RETAINED_PAYMENT: CONFLICT,
    LOST_RACE: CONFLICT
};

function isRejection(reason: string | undefined): reason is Rejection {
    return (
        reason !== undefined &&
        (
            [
                ...REGISTER_MANUAL_PAYMENT_REJECTIONS,
                ...DECLARE_MANUAL_UNPAID_REJECTIONS
            ] as readonly string[]
        ).includes(reason)
    );
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

/** Lists only the installments of the requested subscription. */
export const adminListManualPaymentsRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/manual-payments',
    summary: 'List manual payment installments',
    description: 'Read the installments of one subscription.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestParams: ManualPaymentListParamsSchema.shape,
    responseSchema: ManualPaymentListResponseSchema,
    handler: async (ctx, params) => {
        const subscriptionId = params.subscriptionId as string;
        const subscription = await readSubscription(subscriptionId);
        if (!subscription)
            return createErrorResponse(
                { code: ServiceErrorCode.NOT_FOUND, message: 'Subscription not found' },
                ctx,
                404
            );
        const rows = await getDb()
            .select({
                id: manualPayments.id,
                periodStart: manualPayments.periodStart,
                status: manualPayments.status,
                registeredBy: manualPayments.registeredBy,
                registeredAt: manualPayments.registeredAt,
                proofRef: manualPayments.proofRef
            })
            .from(manualPayments)
            .where(eq(manualPayments.subscriptionId, subscriptionId))
            .orderBy(manualPayments.periodStart, manualPayments.id);
        const actor = getActorFromContext(ctx);
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'subscription',
            resourceId: subscriptionId,
            metadata: { subjectId: subscription.subjectId }
        });
        return rows.map((row) => ({
            ...row,
            periodStart: row.periodStart.toISOString(),
            registeredAt: row.registeredAt?.toISOString() ?? null
        }));
    }
});

/** Read-only confirmation of administrative action 3 (MP1). */
export const adminManualPaymentRegistrationPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/manual-payments/{manualPaymentId}/register',
    summary: 'Preview manual payment registration',
    description: 'Confirm the MP1 effect and next charge date before registration.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT],
    requestParams: ManualPaymentParamsSchema.shape,
    responseSchema: ManualPaymentRegistrationPreviewResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        try {
            const preview = await previewManualPaymentRegistration({
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
                nextChargeAt: preview.nextChargeAt.toISOString()
            };
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

/** Registers an awaiting installment through MP1. */
export const adminRegisterManualPaymentRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/manual-payments/{manualPaymentId}/register',
    summary: 'Register a manual payment',
    description: 'Perform administrative action 3 (MP1).',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT],
    requestParams: ManualPaymentParamsSchema.shape,
    requestBody: ManualPaymentRegistrationBodySchema,
    responseSchema: ManualPaymentRegistrationResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = ManualPaymentRegistrationBodySchema.parse(body);
        const subscriptionId = params.subscriptionId as string;
        try {
            const clock = getClock().clock;
            const coverageNotices = getCoverageNotices();
            const billingFacts = getAnalyticsFactSink();
            const result = await registerManualPayment(
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
                    afterActivation: (activation) =>
                        afterSubscriptionActivated(activation, {
                            provider: getPaymentProvider(),
                            clock,
                            beforeCancelNotice,
                            touristVipInheritance,
                            changeDirection: createPlanCatalogInverse({ reader: planCatalogModel })
                                .changeDirection,
                            coverageNotices,
                            billingFacts
                        })
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
                    subjectId: await auditSubjectOf(subscriptionId)
                }
            });
            return { ...result, nextChargeAt: result.nextChargeAt.toISOString() };
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

/** Read-only confirmation of administrative action 4 (MP2). */
export const adminManualUnpaidPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/manual-payments/{manualPaymentId}/declare-unpaid',
    summary: 'Preview manual unpaid declaration',
    description: 'Confirm the S6 effect before declaring an installment unpaid.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID],
    requestParams: ManualPaymentParamsSchema.shape,
    responseSchema: ManualUnpaidPreviewResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        try {
            const preview = await previewManualUnpaidDeclaration({
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
            return { ...preview, periodStart: preview.periodStart.toISOString() };
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

/** Declares an awaiting installment unpaid through MP2 and S6. */
export const adminDeclareManualUnpaidRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/manual-payments/{manualPaymentId}/declare-unpaid',
    summary: 'Declare a manual installment unpaid',
    description: 'Perform administrative action 4 (MP2).',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID],
    requestParams: ManualPaymentParamsSchema.shape,
    responseSchema: ManualUnpaidResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const result = await declareManualPaymentUnpaid(
                { actor, subscriptionId, manualPaymentId: params.manualPaymentId as string },
                {
                    clock: getClock().clock,
                    beforeCancelNotice,
                    coverageNotices: getCoverageNotices()
                }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_4',
                    effect: 'S6',
                    subjectId: await auditSubjectOf(subscriptionId)
                }
            });
            return result;
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

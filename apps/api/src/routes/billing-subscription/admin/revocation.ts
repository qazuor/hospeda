import {
    PermissionEnum,
    ServiceErrorCode,
    SubscriptionRevocationParamsSchema,
    type SubscriptionRevocationPreviewResponse,
    SubscriptionRevocationPreviewResponseSchema,
    SubscriptionRevocationRequestSchema,
    type SubscriptionRevocationResponse,
    SubscriptionRevocationResponseSchema
} from '@repo/schemas';
import {
    previewSubscriptionRevocation,
    providerLinkCancellationSeen,
    REVOKE_SUBSCRIPTION_REJECTIONS,
    type RevokeSubscriptionRejection,
    revokeSubscription,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { buildBillingCoveragePorts } from '../../../utils/listing-access/billing-coverage';
import { createBootstrapCoverageReader } from '../../../utils/listing-access/bootstrap-coverage-reader';
import { getCoverageNotices } from '../../../utils/listing-access/coverage-notices';
import { getPaymentProvider } from '../../../utils/payment-provider';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { beforeCancelNotice } from '../before-cancel-notice';
import { readSubscription } from '../read-subscription';

/** The HTTP answer of one typed rejection of S36 (error-contract «Action 8 revocation rejections»). */
type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const UNPROCESSABLE: RejectionAnswer = { status: 422, code: ServiceErrorCode.VALIDATION_ERROR };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };

/**
 * Every rejection of `previewSubscriptionRevocation` and `revokeSubscription`, mapped
 * exhaustively (I-10): a new `reason` in the service without an entry here breaks the
 * typecheck. None is an `INTERNAL_ERROR`.
 */
const REJECTION_ANSWERS: Readonly<Record<RevokeSubscriptionRejection, RejectionAnswer>> = {
    SUBSCRIPTION_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    REVOCATION_NOT_PRINCIPAL: CONFLICT,
    REVOCATION_STATE_NOT_ALLOWED: CONFLICT,
    REVOCATION_PAYMENT_CHANGED: CONFLICT,
    REVOCATION_STATE_CHANGED: CONFLICT,
    PAYMENT_NOT_REFUNDABLE: CONFLICT,
    REVOCATION_NO_CREDITED_PAYMENT: UNPROCESSABLE,
    REVOCATION_WINDOW_CLOSED: UNPROCESSABLE,
    REVOCATION_AMOUNT_UNAVAILABLE: UNPROCESSABLE,
    REFUND_EXCEEDS_BALANCE: UNPROCESSABLE,
    REFUND_AMOUNT_INVALID: UNPROCESSABLE
};

function isRevocationRejection(reason: string | undefined): reason is RevokeSubscriptionRejection {
    return (
        reason !== undefined &&
        (REVOKE_SUBSCRIPTION_REJECTIONS as readonly string[]).includes(reason)
    );
}

/**
 * Answers a typed rejection of S36 with its status and `reason`; any other error
 * (a `ServiceError` without a listed reason included) is rethrown.
 */
function answerRejection(input: { readonly error: unknown; readonly ctx: Context }) {
    const { error, ctx } = input;
    if (error instanceof ServiceError && isRevocationRejection(error.reason)) {
        const answer = REJECTION_ANSWERS[error.reason];
        return createErrorResponse(
            { code: answer.code, message: error.message, reason: error.reason },
            ctx,
            answer.status
        );
    }
    throw error;
}

/**
 * The subject of the audit record, read AFTER the service decided (never to decide).
 * Best effort: a failed read after the act has committed must not turn the answer into
 * a 500, so it yields `null`.
 */
async function auditSubjectOf(subscriptionId: string): Promise<string | null> {
    try {
        return (await readSubscription(subscriptionId))?.subjectId ?? null;
    } catch {
        return null;
    }
}

const DESCRIPTION_SUFFIX =
    'Requires billing.cancelSubscription; the action permission, the owner as subject and the system actor are evaluated by the service inside its transaction.';

/**
 * GET /api/v1/admin/billing-subscription/{subscriptionId}/revocation — the confirmation
 * of administrative action 8 with reason revocation (ACC:8, S36; D-3): the payment that
 * would be returned, its amount, the end of the 10-day window and the three things the
 * act does. It writes nothing and rejects with the same reasons as the act. Shares path
 * and permission with the POST on purpose: route middlewares are per path.
 */
export const adminSubscriptionRevocationPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/revocation',
    summary: 'Preview revoking a subscription (ACC:8, S36)',
    description: `Administrative action 8 with reason revocation: shows the last credited payment that would be refunded, its amount, the end of the 10-day window and the effects. ${DESCRIPTION_SUFFIX}`,
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
    requestParams: SubscriptionRevocationParamsSchema.shape,
    responseSchema: SubscriptionRevocationPreviewResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        try {
            const preview = await previewSubscriptionRevocation(
                { actor, subscriptionId: params.subscriptionId as string },
                { clock: getClock().clock }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'subscription',
                resourceId: preview.subscriptionId,
                metadata: { subjectId: await auditSubjectOf(preview.subscriptionId) }
            });
            const response: SubscriptionRevocationPreviewResponse = {
                subscriptionId: preview.subscriptionId,
                origin: preview.origin,
                payment: {
                    source: preview.payment.source,
                    id: preview.payment.id,
                    amount: preview.payment.amount,
                    currency: preview.payment.currency,
                    chargedAt: preview.payment.chargedAt.toISOString(),
                    ownerSubscriptionId: preview.payment.ownerSubscriptionId
                },
                windowEndsAt: preview.windowEndsAt.toISOString(),
                effects: preview.effects
            };
            return response;
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

/**
 * POST /api/v1/admin/billing-subscription/{subscriptionId}/revocation — administrative
 * action 8 with reason revocation (ACC:8, S36; AC:B5:20): in one act the row goes to
 * `CANCELLED` with its service ended now and an RF1 is requested for the total of the
 * last credited payment; the provider authorization is cancelled after the commit.
 * `expectedPaymentId` is the payment the preview showed (409 if it changed).
 * `requiredPermissions` is only the route's early 403; the route reads neither the
 * subscription nor the subject.
 */
export const adminRevokeSubscriptionRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/revocation',
    summary: 'Revoke a subscription (ACC:8, S36)',
    description: `Administrative action 8 with reason revocation: cancels the subscription, ends its service now and requests an RF1 for the total of the last credited payment, within 10 calendar days of that charge. ${DESCRIPTION_SUFFIX}`,
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
    requestParams: SubscriptionRevocationParamsSchema.shape,
    requestBody: SubscriptionRevocationRequestSchema,
    responseSchema: SubscriptionRevocationResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = SubscriptionRevocationRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const { addonPolicy, listing } = buildBillingCoveragePorts({
                reader: createBootstrapCoverageReader()
            }).ports;
            const result = await revokeSubscription(
                {
                    actor,
                    subscriptionId: params.subscriptionId as string,
                    expectedPaymentId: input.expectedPaymentId
                },
                {
                    provider: getPaymentProvider(),
                    clock: getClock().clock,
                    beforeCancelNotice,
                    coverageNotices: getCoverageNotices(),
                    orphanhood: { addonPolicy, listing },
                    cancellationSeen: providerLinkCancellationSeen
                }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: result.subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_8',
                    transition: 'S36',
                    motive: 'REVOCATION',
                    subjectId: await auditSubjectOf(result.subscriptionId),
                    origin: result.origin,
                    orphanedAddonIds: result.orphanedAddonIds,
                    refundId: result.refundId,
                    ...(result.payment.source === 'PAYMENT'
                        ? { paymentId: result.payment.id }
                        : { manualPaymentId: result.payment.id }),
                    refundAmount: result.refundAmount,
                    cancelCall: result.cancelCall,
                    ...(result.escalated ? { escalated: result.escalated } : {}),
                    ...(input.note ? { note: input.note } : {})
                }
            });
            const response: SubscriptionRevocationResponse = {
                subscriptionId: result.subscriptionId,
                status: 'CANCELLED',
                origin: result.origin,
                serviceEndedAt: result.serviceEndedAt.toISOString(),
                refundId: result.refundId,
                refundAmount: result.refundAmount,
                payment: { source: result.payment.source, id: result.payment.id },
                cancelCall: result.cancelCall,
                ...(result.escalated ? { escalated: result.escalated } : {})
            };
            return response;
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});

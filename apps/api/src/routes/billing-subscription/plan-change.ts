import { PaymentProviderError } from '@repo/payments';
import {
    ServiceErrorCode,
    SubscriptionPlanChangeParamsSchema,
    SubscriptionPlanChangeRequestSchema,
    SubscriptionPlanChangeResponseSchema
} from '@repo/schemas';
import {
    entityNotFoundError,
    type RequestPlanChangeResult,
    requestPlanChange,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { env } from '../../utils/env';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { buildPlanChangePorts } from './plan-change-ports';
import { readSubscription } from './read-subscription';

type Rejection = Extract<RequestPlanChangeResult, { path: 'REJECTED' }>['reason'];
/** Shared mapping of typed plan-change rejections to HTTP responses. */
export const rejectionAnswer: Readonly<Record<Rejection, { status: 409 | 422; code: string }>> = {
    GRACE_PERIOD: { status: 409, code: 'CONFLICT' },
    NOT_ACTIVE: { status: 409, code: 'CONFLICT' },
    SCHEDULED_CHANGE_EXISTS: { status: 409, code: 'CONFLICT' },
    MIGRATION_CHANGE_QUEUED: { status: 409, code: 'CONFLICT' },
    CHANGE_WINDOW_TOO_SHORT: { status: 409, code: 'CONFLICT' },
    CYCLE_END_PENDING: { status: 409, code: 'CONFLICT' },
    NO_CHANGE: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    KEEP_SELECTION_INVALID: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR }
};

const serviceAnswer: Readonly<Record<string, { status: 404 | 409 | 422; code: string }>> = {
    SUBSCRIPTION_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    BILLING_OPTION_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    PREDECESSOR_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    PREDECESSOR_TARGET_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    PLAN_CHANGE_STATE_CHANGED: { status: 409, code: 'CONFLICT' },
    SUCCESSION_IN_PROGRESS: { status: 409, code: 'CONFLICT' },
    SUCCESSION_PREDECESSOR_MOVED: { status: 409, code: 'CONFLICT' },
    PREDECESSOR_STATUS_NOT_ADMITTED: { status: 409, code: 'CONFLICT' },
    SUCCESSION_VERTICAL_MISMATCH: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    PREDECESSOR_IS_A_SUCCESSOR: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    MANUAL_PAYER_SUCCESSION_NOT_AVAILABLE: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    PREDECESSOR_NO_PROVIDER_LINK: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    LAST_CHARGE_NOT_ENTERED: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    PREAPPROVAL_NOT_AUTHORIZED: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    SUSPENDED_PREAPPROVAL_STILL_LIVE: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    SUCCESSION_WINDOW_TOO_SHORT: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    PREDECESSOR_MARKED_NOT_SUCCEEDABLE: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    PREDECESSOR_MARKED_NO_PROVIDER_LINK: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    PREDECESSOR_MARKED_PREAPPROVAL_STILL_LIVE: {
        status: 422,
        code: ServiceErrorCode.VALIDATION_ERROR
    }
};

/** Apply the owner route's service and provider error mapping. */
export function answer(error: unknown, ctx: Context): Response {
    if (error instanceof ServiceError && error.reason === 'CREATION_NOT_APPLIED')
        return createErrorResponse(
            {
                code: ServiceErrorCode.PROVIDER_ERROR,
                message: 'Payment provider did not apply the requested authorization',
                reason: 'CREATION_NOT_APPLIED',
                details: { reason: 'CREATION_NOT_APPLIED' }
            },
            ctx,
            502
        );
    if (error instanceof ServiceError && error.reason) {
        const mapped = serviceAnswer[error.reason];
        if (mapped)
            return createErrorResponse(
                {
                    code: mapped.code,
                    message: error.message,
                    reason: error.reason,
                    details: { reason: error.reason }
                },
                ctx,
                mapped.status
            );
    }
    if (error instanceof PaymentProviderError) {
        if (error.code === 'REJECTED')
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Payment provider rejected the request',
                    reason: 'PROVIDER_REJECTED',
                    details: { reason: 'PROVIDER_REJECTED' }
                },
                ctx,
                422
            );
        if (error.transient) {
            const { kind, retryAfterSeconds } = error.transient;
            const reason = kind === 'RATE_LIMITED' ? 'PROVIDER_BUSY' : 'PROVIDER_UNAVAILABLE';
            return createErrorResponse(
                {
                    code:
                        kind === 'RATE_LIMITED'
                            ? ServiceErrorCode.PROVIDER_RATE_LIMITED
                            : ServiceErrorCode.SERVICE_UNAVAILABLE,
                    message: 'The payment provider is busy; try again in a minute',
                    reason,
                    details: {
                        reason,
                        ...(retryAfterSeconds === undefined
                            ? {}
                            : { retryAfter: retryAfterSeconds })
                    }
                },
                ctx,
                503,
                retryAfterSeconds === undefined
                    ? undefined
                    : { 'Retry-After': String(retryAfterSeconds) }
            );
        }
    }
    throw error;
}

async function owned(subscriptionId: string, actorId: string): Promise<void> {
    const found = await readSubscription(subscriptionId);
    if (!found || found.subjectId !== actorId)
        throw entityNotFoundError({ entityName: 'Subscription' });
}

/** Declare an owner plan change on the existing B3 successor writer. */
export const protectedPlanChangeRoute = createProtectedRoute({
    method: 'post',
    path: '/{subscriptionId}/plan-change',
    summary: 'Change own subscription plan',
    description: 'Chooses succession or a scheduled downgrade from the destination option.',
    tags: ['Billing subscriptions'],
    requestParams: SubscriptionPlanChangeParamsSchema.shape,
    requestBody: SubscriptionPlanChangeRequestSchema,
    responseSchema: SubscriptionPlanChangeResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        await owned(subscriptionId, actor.id);
        const { billingOptionId, payerEmail, keepSelection } =
            SubscriptionPlanChangeRequestSchema.parse(body);
        try {
            const result = await requestPlanChange(
                {
                    actor: { id: actor.id },
                    subscriptionId,
                    billingOptionId,
                    payerEmail,
                    keepSelection,
                    returnUrl: env.HOSPEDA_SITE_URL
                },
                await buildPlanChangePorts()
            );
            if (result.path === 'REJECTED') {
                const mapped = rejectionAnswer[result.reason];
                return createErrorResponse(
                    {
                        code: mapped.code,
                        message: 'Plan change rejected',
                        reason: result.reason,
                        details: {
                            reason: result.reason,
                            ...(result.reason === 'CHANGE_WINDOW_TOO_SHORT'
                                ? { availableFrom: result.availableFrom.toISOString() }
                                : {})
                        }
                    },
                    ctx,
                    mapped.status
                );
            }
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: { subjectId: actor.id, outcome: result.path }
            });
            if (result.path === 'SUCCESSION')
                return {
                    outcome: result.path,
                    subscriptionId: result.subscriptionId,
                    checkoutUrl: result.checkoutUrl,
                    firstChargeAt: result.firstChargeAt.toISOString(),
                    creditDays: result.creditDays
                };
            if (result.path === 'DOWNGRADE')
                return {
                    outcome: result.path,
                    effectiveAt: result.effectiveAt.toISOString(),
                    amountMinor: result.amountMinor,
                    replaced: result.replaced,
                    surplus: result.surplus
                };
            return { outcome: result.path, amountMinor: result.amountMinor };
        } catch (error) {
            return answer(error, ctx);
        }
    }
});

import { planCatalogModel } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import type { StartSubscriptionRejectionReason } from '@repo/schemas';
import {
    ServiceErrorCode,
    SignupNoticeResponseSchema,
    StartSubscriptionRejectionReasonSchema,
    StartSubscriptionRequestSchema,
    StartSubscriptionResponseSchema,
    VerticalEnumSchema
} from '@repo/schemas';
import { emitBillingFact, ServiceError, startSubscription } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext, isGuestActor } from '../../utils/actor';
import { getAnalyticsFactSink } from '../../utils/analytics/analytics-facts';
import { getClock } from '../../utils/clock';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { getPaymentProvider } from '../../utils/payment-provider';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { beforeCancelNotice } from './before-cancel-notice';
import {
    protectedCancellationPreviewRoute,
    protectedCancelSubscriptionRoute
} from './cancellation';
import { protectedPendingAttemptCancellationRoute } from './pending-attempt-cancellation';
import { protectedPricingSituationRoute } from './pricing-situation';
import { protectedReadSubscriptionRoute } from './read';
import { protectedReadOwnSubscriptionsRoute } from './read-mine';
import { readSignupNotice } from './read-signup-notice';
import { readSignupWindow } from './read-signup-window';
import { touristVipInheritance } from './tourist-vip-inheritance';

const S1_REJECTIONS_WITH_UNPROCESSABLE_ENTITY_STATUS = new Set<StartSubscriptionRejectionReason>([
    'PLAN_NOT_FOR_SALE',
    'PARTNER_MANUAL_ONLY'
]);

/** Machine-readable `reason` of the 503 answered when the payment provider is throttled or down. */
const PROVIDER_BUSY_REASON = 'PROVIDER_BUSY';

export const protectedStartSubscriptionRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Start a card subscription',
    description: 'Creates a pending subscription and a loose authorization mandate.',
    tags: ['Billing subscriptions'],
    requestBody: StartSubscriptionRequestSchema,
    responseSchema: StartSubscriptionResponseSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = StartSubscriptionRequestSchema.parse(body);
        try {
            const result = await startSubscription(
                {
                    userId: actor.id,
                    billingOptionId: parsed.billingOptionId,
                    returnUrl: env.HOSPEDA_SITE_URL,
                    payerEmail: parsed.payerEmail
                },
                {
                    provider: getPaymentProvider(),
                    clock: getClock().clock,
                    planPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy,
                    beforeCancelNotice,
                    touristVipInheritance
                }
            );
            const signupWindow = await readSignupWindow({
                subscriptionId: result.subscriptionId,
                userId: actor.id
            });
            const vertical = VerticalEnumSchema.safeParse(signupWindow?.vertical);
            const authorizationWindowEndsAt = signupWindow?.authorizationWindowEndsAt;
            if (!signupWindow || !vertical.success || !authorizationWindowEndsAt) {
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Signup window missing after S1'
                );
            }
            if (
                signupWindow.subscriptionClass === 'PRINCIPAL' &&
                signupWindow.planVersionId &&
                signupWindow.billingOptionId &&
                signupWindow.cycle &&
                signupWindow.amountMinor !== null &&
                signupWindow.currency === 'ARS'
            ) {
                emitBillingFact({
                    sink: getAnalyticsFactSink(),
                    fact: {
                        kind: 'CHECKOUT_STARTED',
                        userId: actor.id,
                        vertical: vertical.data,
                        subscriptionId: result.subscriptionId,
                        subscriptionClass: 'PRINCIPAL',
                        actorKind: 'USER',
                        planVersionId: signupWindow.planVersionId,
                        billingOptionId: signupWindow.billingOptionId,
                        cycle: signupWindow.cycle as
                            | 'monthly'
                            | 'quarterly'
                            | 'semiannual'
                            | 'annual',
                        amountMinor: signupWindow.amountMinor,
                        currency: 'ARS',
                        isSuccession: signupWindow.isSuccession ? true : undefined,
                        occurredAt: signupWindow.createdAt
                    }
                });
            }
            return {
                ...result,
                vertical: vertical.data,
                authorizationWindowEndsAt: authorizationWindowEndsAt.toISOString()
            };
        } catch (error) {
            if (
                error instanceof PaymentProviderError &&
                error.code === 'REJECTED' &&
                error.capability === 'authorize'
            ) {
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'The payment provider rejected the payment details',
                        reason: 'PROVIDER_REJECTED'
                    },
                    ctx,
                    422
                );
            }
            if (
                error instanceof PaymentProviderError &&
                error.capability === 'authorize' &&
                error.transient
            ) {
                // HOS-1968: a throttled or unavailable provider is a retryable 503, never a 500.
                const { kind, retryAfterSeconds } = error.transient;
                return createErrorResponse(
                    {
                        code:
                            kind === 'RATE_LIMITED'
                                ? ServiceErrorCode.PROVIDER_RATE_LIMITED
                                : ServiceErrorCode.SERVICE_UNAVAILABLE,
                        message: 'The payment provider is busy; try again in a minute',
                        reason: PROVIDER_BUSY_REASON,
                        ...(retryAfterSeconds === undefined
                            ? {}
                            : { details: { retryAfter: retryAfterSeconds } })
                    },
                    ctx,
                    503,
                    retryAfterSeconds === undefined
                        ? undefined
                        : { 'Retry-After': String(retryAfterSeconds) }
                );
            }
            const serviceError = error instanceof ServiceError ? error : null;
            const reason = serviceError
                ? StartSubscriptionRejectionReasonSchema.safeParse(serviceError.reason)
                : null;
            if (
                reason?.success &&
                S1_REJECTIONS_WITH_UNPROCESSABLE_ENTITY_STATUS.has(reason.data)
            ) {
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: serviceError?.message ?? '',
                        reason: reason.data
                    },
                    ctx,
                    422
                );
            }
            throw error;
        }
    }
});

/** Read-only trial notice for the selected billing option before signup. */
export const protectedSignupNoticeRoute = createProtectedRoute({
    method: 'get',
    path: '/signup-notice/{billingOptionId}',
    summary: 'Read the trial notice for a signup option',
    description: 'Returns the selected vertical and the actor trial before confirming signup.',
    tags: ['Billing subscriptions'],
    requestParams: { billingOptionId: z.string().uuid() },
    responseSchema: SignupNoticeResponseSchema,
    options: {
        middlewares: [
            async (ctx, next) => {
                if (isGuestActor(getActorFromContext(ctx))) {
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Authentication required'
                    );
                }
                await next();
            }
        ]
    },
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        readSignupNotice({
            userId: getActorFromContext(ctx).id,
            billingOptionId: params.billingOptionId as string
        })
});

const router = createRouter();
router.route('/', protectedStartSubscriptionRoute);
router.route('/', protectedSignupNoticeRoute);
router.route('/', protectedPendingAttemptCancellationRoute);
export const protectedBillingSubscriptionRoutes = router;

const readRouter = createRouter();
readRouter.route('/', protectedPricingSituationRoute);
readRouter.route('/', protectedReadOwnSubscriptionsRoute);
readRouter.route('/', protectedReadSubscriptionRoute);
readRouter.route('/', protectedCancellationPreviewRoute);
readRouter.route('/', protectedCancelSubscriptionRoute);

export { readRouter as protectedBillingSubscriptionReadRoutes };

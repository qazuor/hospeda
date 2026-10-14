import { eq, getDb, planCatalogModel, users } from '@repo/db';
import {
    ServiceErrorCode,
    SignupNoticeResponseSchema,
    StartSubscriptionRequestSchema,
    StartSubscriptionResponseSchema,
    VerticalEnumSchema
} from '@repo/schemas';
import { ServiceError, startSubscription } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext, isGuestActor } from '../../utils/actor';
import { getClock } from '../../utils/clock';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { getPaymentProvider } from '../../utils/payment-provider';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { beforeCancelNotice } from './before-cancel-notice';
import { protectedReadSubscriptionRoute } from './read';
import { readSignupNotice } from './read-signup-notice';
import { readSignupWindow } from './read-signup-window';
import { touristVipInheritance } from './tourist-vip-inheritance';

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
        const [user] = await getDb()
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, actor.id))
            .limit(1);
        try {
            const result = await startSubscription(
                {
                    userId: actor.id,
                    billingOptionId: parsed.billingOptionId,
                    returnUrl: env.HOSPEDA_SITE_URL,
                    payerEmail: user?.email
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
            return {
                ...result,
                vertical: vertical.data,
                authorizationWindowEndsAt: authorizationWindowEndsAt.toISOString()
            };
        } catch (error) {
            if (error instanceof ServiceError && error.reason === 'PLAN_NOT_FOR_SALE') {
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: error.message,
                        reason: error.reason
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
export const protectedBillingSubscriptionRoutes = router;

const readRouter = createRouter();
readRouter.route('/', protectedReadSubscriptionRoute);

export { readRouter as protectedBillingSubscriptionReadRoutes };

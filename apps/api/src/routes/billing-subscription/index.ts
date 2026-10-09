import { eq, getDb, planCatalogModel, users } from '@repo/db';
import {
    ServiceErrorCode,
    StartSubscriptionRequestSchema,
    StartSubscriptionResponseSchema
} from '@repo/schemas';
import { ServiceError, startSubscription } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { getClock } from '../../utils/clock';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { getPaymentProvider } from '../../utils/payment-provider';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { beforeCancelNotice } from './before-cancel-notice';

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
            return await startSubscription(
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
                    beforeCancelNotice
                }
            );
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

const router = createRouter();
router.route('/', protectedStartSubscriptionRoute);
export const protectedBillingSubscriptionRoutes = router;

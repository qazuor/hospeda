import {
    PricingSituationResponseSchema,
    PricingSituationVerticalSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { readPricingSituation } from '../../services/pricing-situation/read-pricing-situation';
import { getActorFromContext, isGuestActor } from '../../utils/actor';
import { createProtectedRoute } from '../../utils/route-factory';

/** Read the authenticated person's situation for one pricing vertical. */
export const protectedPricingSituationRoute = createProtectedRoute({
    method: 'get',
    path: '/pricing-situation/{vertical}',
    summary: "Read a person's pricing situation",
    description: 'Returns the subscription and publication situation for one pricing vertical.',
    tags: ['Billing subscriptions'],
    requestParams: { vertical: PricingSituationVerticalSchema },
    responseSchema: PricingSituationResponseSchema,
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
        readPricingSituation({
            userId: getActorFromContext(ctx).id,
            vertical: PricingSituationVerticalSchema.parse(params.vertical)
        })
});

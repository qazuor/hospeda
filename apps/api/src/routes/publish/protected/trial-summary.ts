import {
    ServiceErrorCode,
    SubscribeDestinationVerticalSchema,
    TrialSummaryResponseSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { readTrialSummary } from '../../../services/listing-notices/listing-notices.service';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/publish/trial-summary/{vertical} (HOS-1492, H3, row 4):
 * the actor's accumulated trial days in the vertical and their origin.
 */
export const protectedTrialSummaryRoute = createProtectedRoute({
    method: 'get',
    path: '/trial-summary/{vertical}',
    summary: 'Read own trial summary',
    description:
        'Returns the accumulated trial days of the actor in the vertical and their origin.',
    tags: ['Publish'],
    requestParams: { vertical: SubscribeDestinationVerticalSchema },
    responseSchema: TrialSummaryResponseSchema,
    options: {
        middlewares: [
            async (ctx, next) => {
                if (isGuestActor(getActorFromContext(ctx)))
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Authentication required'
                    );
                await next();
            }
        ]
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        if (isGuestActor(actor))
            throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
        const vertical = SubscribeDestinationVerticalSchema.parse(params.vertical);
        return readTrialSummary({ userId: actor.id, vertical });
    }
});

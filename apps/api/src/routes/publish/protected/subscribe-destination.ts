import {
    ServiceErrorCode,
    SubscribeDestinationResponseSchema,
    SubscribeDestinationVerticalSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { resolveSubscribeDestinationForUser } from '../../../services/listing-publication/subscribe-destination.service';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

export const protectedSubscribeDestinationRoute = createProtectedRoute({
    method: 'get',
    path: '/subscribe-destination/{vertical}',
    summary: 'Resolve subscription button destination',
    description: 'Returns the canonical read-only destination for subscribing in a vertical.',
    tags: ['Publish'],
    requestParams: { vertical: SubscribeDestinationVerticalSchema },
    responseSchema: SubscribeDestinationResponseSchema,
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
        return resolveSubscribeDestinationForUser({ userId: actor.id, vertical });
    }
});

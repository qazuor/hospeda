import {
    ListingNoticesResponseSchema,
    ServiceErrorCode,
    SubscribeDestinationVerticalSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { listListingNotices } from '../../../services/listing-notices/listing-notices.service';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/publish/listing-notices/{vertical} (HOS-1492, H2): the
 * notices of every listing of the actor in the vertical (rows 8/9, 18, 20, 24,
 * 30, 31) and whether the actor's trial there is running (row 2). Read-only.
 */
export const protectedListingNoticesRoute = createProtectedRoute({
    method: 'get',
    path: '/listing-notices/{vertical}',
    summary: 'List the notices of own listings',
    description:
        'Returns, for every listing of the actor in the vertical, the notices Mi Cuenta shows.',
    tags: ['Publish'],
    requestParams: { vertical: SubscribeDestinationVerticalSchema },
    responseSchema: ListingNoticesResponseSchema,
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
        return listListingNotices({ userId: actor.id, vertical });
    }
});

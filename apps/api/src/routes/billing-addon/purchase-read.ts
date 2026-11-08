import { AddonPurchaseReadResponseSchema } from '@repo/schemas';
import { readAddonPurchase } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';

/** Read the current actor's addon purchase by its request identity. */
export const protectedAddonPurchaseReadRoute = createProtectedRoute({
    method: 'get',
    path: '/purchases/{orderRequestId}',
    summary: 'Read own addon purchase',
    description: 'Returns the actor purchase status without exposing another owner.',
    tags: ['Billing addons'],
    requestParams: { orderRequestId: z.string().min(1).max(64) },
    responseSchema: AddonPurchaseReadResponseSchema,
    handler: async (ctx, params) => {
        const found = await readAddonPurchase({
            ownerId: getActorFromContext(ctx).id,
            orderRequestId: params.orderRequestId as string
        });
        if (!found)
            return createErrorResponse(
                {
                    code: 'ADDON_PURCHASE_NOT_FOUND',
                    message: 'Addon purchase not found',
                    reason: 'ADDON_PURCHASE_NOT_FOUND'
                },
                ctx,
                404
            );
        return found;
    }
});

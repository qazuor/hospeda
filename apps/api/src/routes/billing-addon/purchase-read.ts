import { AddonPurchaseReadResponseSchema } from '@repo/schemas';
import { readAddonPurchase } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { buildAddonPurchasePorts } from './purchase-ports';
import { readAddonPurchaseCopy } from './purchase-rejections';

/**
 * Read the current actor's addon purchase by its request identity. This is what the screen
 * calls when the owner comes back from the provider: a one-time purchase still waiting on its
 * payment page is first confirmed by searching its payments and re-reading each by id
 * (HOS-2179 §5.3 path 2). The return URL's parameters never reach this route.
 */
export const protectedAddonPurchaseReadRoute = createProtectedRoute({
    method: 'get',
    path: '/purchases/{orderRequestId}',
    summary: 'Read own addon purchase',
    description:
        'Returns the actor purchase status without exposing another owner, confirming a waiting one-time payment with the provider first.',
    tags: ['Billing addons'],
    requestParams: { orderRequestId: z.string().min(1).max(64) },
    responseSchema: AddonPurchaseReadResponseSchema,
    handler: async (ctx, params) => {
        const found = await readAddonPurchase(
            {
                ownerId: getActorFromContext(ctx).id,
                orderRequestId: params.orderRequestId as string
            },
            buildAddonPurchasePorts()
        );
        if (!found)
            return createErrorResponse(
                {
                    code: 'ADDON_PURCHASE_NOT_FOUND',
                    message: readAddonPurchaseCopy(ctx, 'purchaseNotFound'),
                    reason: 'ADDON_PURCHASE_NOT_FOUND'
                },
                ctx,
                404
            );
        return found;
    }
});

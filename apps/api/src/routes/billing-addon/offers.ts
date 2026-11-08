import { AddonOffersResponseSchema } from '@repo/schemas';
import { readAddonOffers } from '../../services/addon-offers/addon-offers.service';
import { getActorFromContext } from '../../utils/actor';
import { createProtectedRoute } from '../../utils/route-factory';

/** Read the addon products and grant options available to the signed-in owner. */
export const protectedAddonOffersRoute = createProtectedRoute({
    method: 'get',
    path: '/offers',
    summary: 'Read addon offers',
    description: 'Returns current addon products with policy and the owner grant options.',
    tags: ['Billing addons'],
    responseSchema: AddonOffersResponseSchema,
    handler: async (ctx) => readAddonOffers({ ownerId: getActorFromContext(ctx).id })
});

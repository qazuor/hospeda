import {
    ProtectedEffectiveSetQuerySchema,
    ProtectedEffectiveSetResponseSchema,
    type VerticalEnum
} from '@repo/schemas';
import { getActorFromContext } from '../../../utils/actor';
import { toEffectiveSetView } from '../../../utils/listing-access/effective-set-view';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { createProtectedRoute } from '../../../utils/route-factory';

export const protectedGetMyEffectiveSetRoute = createProtectedRoute({
    method: 'get',
    path: '/me/effective-set',
    summary: 'Get own effective set',
    description:
        'Reads V3 effective entitlements and limits for the authenticated user and vertical.',
    tags: ['Users'],
    emailUnverifiedOperation: 'READ_OWN',
    requestQuery: ProtectedEffectiveSetQuerySchema.shape,
    responseSchema: ProtectedEffectiveSetResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const userId = actor.id;
        const vertical = query?.vertical as VerticalEnum;
        const effective = await getListingAccessPorts().effectiveSet({ userId, vertical });
        return toEffectiveSetView({ effective, userId, vertical });
    }
});

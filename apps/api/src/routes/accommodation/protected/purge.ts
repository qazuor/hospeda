import { AccommodationIdSchema, VerticalEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { ListingPurgeService } from '../../../services/listing-publication/listing-purge.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const service = new ListingPurgeService();
/** Owner PB12 route for accommodation listings. */
export const protectedPurgeAccommodationRoute = createProtectedRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/purge',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'DELETE', idParam: 'id' },
    emailUnverifiedOperation: 'DELETE_LISTING',
    summary: 'Purge own accommodation listing',
    description: 'Permanently removes listing content through PB12.',
    tags: ['Accommodations'],
    requestParams: { id: AccommodationIdSchema },
    responseSchema: z.object({ purged: z.literal(true) }),
    ownership: { entityType: 'accommodation', ownershipFields: ['ownerId', 'createdById'] },
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        service.purge({
            actor: getActorFromContext(ctx),
            vertical: VerticalEnum.ACCOMMODATION,
            id: params.id as string
        })
});

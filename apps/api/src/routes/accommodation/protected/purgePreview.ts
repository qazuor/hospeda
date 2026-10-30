import {
    AccommodationIdSchema,
    ListingPurgePreviewResponseSchema,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { readListingPurgePreview } from '../../../services/listing-publication/listing-purge-preview.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Owner-only read of the add-ons left behind by purging an accommodation. */
export const protectedAccommodationPurgePreviewRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/purge-preview',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'READ_OWN', idParam: 'id' },
    emailUnverifiedOperation: 'READ_OWN',
    summary: 'Preview add-ons lost when purging own accommodation',
    description: 'Lists live listing add-ons that remain after a purge.',
    tags: ['Accommodations'],
    requestParams: { id: AccommodationIdSchema },
    responseSchema: ListingPurgePreviewResponseSchema,
    ownership: { entityType: 'accommodation', ownershipFields: ['ownerId', 'createdById'] },
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        readListingPurgePreview({
            ownerId: getActorFromContext(ctx).id,
            listingId: params.id as string
        })
});

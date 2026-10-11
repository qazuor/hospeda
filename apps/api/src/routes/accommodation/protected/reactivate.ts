import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { getActorFromContext } from '../../../utils/actor';
import { stripRichDescriptionFields } from '../../../utils/entitlement-filter';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingPublicationService = new ListingPublicationService();

/** POST /api/v1/protected/accommodations/{id}/reactivate */
export const protectedReactivateAccommodationRoute = createProtectedRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/reactivate',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'REACTIVATE', idParam: 'id' },
    summary: 'Reactivate archived accommodation listing',
    description: 'Moves an archived listing back to DRAFT through PB8.',
    tags: ['Accommodations'],
    requestParams: { id: AccommodationIdSchema },
    responseSchema: AccommodationProtectedSchema,
    ownership: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const data = await listingPublicationService.reactivate({ actor, id: params.id as string });
        return stripRichDescriptionFields(data);
    }
});

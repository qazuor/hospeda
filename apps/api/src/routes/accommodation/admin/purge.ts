import {
    AccommodationIdSchema,
    ListingPurgeOnRequestResponseSchema,
    ListingPurgeOnRequestSchema,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { ListingPurgeService } from '../../../services/listing-publication/listing-purge.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new ListingPurgeService();

/**
 * POST /api/v1/admin/accommodations/{id}/purge — administrative action 23 (ACC:23):
 * support purges another owner's accommodation listing at that owner's request, with a
 * mandatory reason, by running PB12. No `requiredPermissions`: the action's own
 * permission is checked by the V5 chain (step 3) with the owner as subject.
 */
export const adminPurgeOnRequestAccommodationRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/purge',
    listingAccess: {
        vertical: VerticalEnum.ACCOMMODATION,
        operation: 'DELETE',
        idParam: 'id',
        administrativeAction: 'ACC_23'
    },
    summary: 'Purge accommodation listing at the owner request (ACC:23)',
    description:
        'Administrative action 23: runs PB12 on another owner listing at that owner request, with a mandatory reason. Requires LISTING_PURGE_ON_REQUEST, evaluated on the owner.',
    tags: ['Accommodations', 'Admin'],
    requestParams: { id: AccommodationIdSchema },
    requestBody: ListingPurgeOnRequestSchema,
    responseSchema: ListingPurgeOnRequestResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        service.purgeOnRequest({
            actor: getActorFromContext(ctx),
            vertical: VerticalEnum.ACCOMMODATION,
            id: params.id as string,
            reason: ListingPurgeOnRequestSchema.parse(body).reason
        })
});

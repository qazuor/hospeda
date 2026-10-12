import {
    AccommodationIdSchema,
    ListingModerationActionSchema,
    ListingModerationResponseSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { ListingModerationService } from '../../../services/listing-publication/listing-moderation.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new ListingModerationService();

/** POST /api/v1/admin/accommodations/{id}/moderate — ACC:12 two-level moderation (PB10/PB11/PB13 and fix requests); legacy moderation_state has no route and V6.9b retires it. */
export const adminModerateAccommodationRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/moderate',
    summary: 'Moderate accommodation listing',
    description:
        'Applies a two-level listing moderation action or manages its fix request. Requires LISTING_MODERATE.',
    tags: ['Accommodations', 'Admin'],
    requiredPermissions: [PermissionEnum.LISTING_MODERATE],
    requestParams: { id: AccommodationIdSchema },
    requestBody: ListingModerationActionSchema,
    responseSchema: ListingModerationResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        service.moderate({
            actor: getActorFromContext(ctx),
            vertical: VerticalEnum.ACCOMMODATION,
            id: params.id as string,
            body: ListingModerationActionSchema.parse(body)
        })
});

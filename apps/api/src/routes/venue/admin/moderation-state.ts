import { ListingModerationStateSchema, PermissionEnum, VerticalEnum } from '@repo/schemas';
import { z } from 'zod';
import { ListingModerationService } from '../../../services/listing-publication/listing-moderation.service';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new ListingModerationService();

/** Reads the current listing moderation state for the admin panel. */
export const adminGetVenueModerationStateRoute = createAdminRoute({
    method: 'get',
    successStatusCode: 200,
    path: '/{id}/moderation',
    summary: 'Read listing moderation state',
    description: 'Reads publication status and the open fix request. Requires LISTING_MODERATE.',
    tags: ['Gastronomys', 'Admin'],
    requiredPermissions: [PermissionEnum.LISTING_MODERATE],
    requestParams: { id: z.string().uuid() },
    responseSchema: ListingModerationStateSchema,
    handler: async (_ctx, params) =>
        service.readState({ vertical: VerticalEnum.VENUE, id: params.id as string })
});

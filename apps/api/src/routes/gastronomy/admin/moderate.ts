import {
    ListingModerationActionSchema,
    ListingModerationResponseSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { ListingModerationService } from '../../../services/listing-publication/listing-moderation.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new ListingModerationService();

/** POST /api/v1/admin/gastronomies/{id}/moderate — ACC:12 two-level moderation; the legacy moderation column was retired by V6.9b (HOS-1641). */
export const adminModerateGastronomyRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/moderate',
    summary: 'Moderate gastronomy listing',
    description:
        'Applies PB10/PB11/PB13 moderation and manages fix requests. Requires LISTING_MODERATE.',
    tags: ['Gastronomies', 'Admin'],
    requiredPermissions: [PermissionEnum.LISTING_MODERATE],
    requestParams: { id: z.string().uuid() },
    requestBody: ListingModerationActionSchema,
    responseSchema: ListingModerationResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        service.moderate({
            actor: getActorFromContext(ctx),
            vertical: VerticalEnum.GASTRONOMY,
            id: params.id as string,
            body: ListingModerationActionSchema.parse(body)
        })
});

import {
    ExperienceIdSchema,
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

/** POST /api/v1/admin/experiences/{id}/moderate — ACC:12 two-level moderation; the legacy moderation column was retired by V6.9b (HOS-1641). */
export const adminModerateExperienceRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/moderate',
    summary: 'Moderate experience listing',
    description:
        'Applies PB10/PB11/PB13 moderation and manages fix requests. Requires LISTING_MODERATE.',
    tags: ['Experiences', 'Admin'],
    requiredPermissions: [PermissionEnum.LISTING_MODERATE],
    requestParams: { id: ExperienceIdSchema },
    requestBody: ListingModerationActionSchema,
    responseSchema: ListingModerationResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        service.moderate({
            actor: getActorFromContext(ctx),
            vertical: VerticalEnum.EXPERIENCE,
            id: params.id as string,
            body: ListingModerationActionSchema.parse(body)
        })
});

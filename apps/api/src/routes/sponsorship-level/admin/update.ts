/**
 * Admin update sponsorship level endpoint
 * Requires admin authentication
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    SponsorshipLevelIdSchema,
    SponsorshipLevelSchema,
    SponsorshipLevelUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipLevelService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const sponsorshipLevelService = new SponsorshipLevelService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/sponsorship-levels/:id
 * Update sponsorship level - Admin endpoint
 */
export const updateSponsorshipLevelRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update sponsorship level',
    description: 'Updates an existing sponsorship level. Requires ADMIN role.',
    tags: ['Sponsorship Levels'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_UPDATE],
    requestParams: { id: SponsorshipLevelIdSchema },
    requestBody: SponsorshipLevelUpdateInputSchema,
    responseSchema: SponsorshipLevelSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await sponsorshipLevelService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

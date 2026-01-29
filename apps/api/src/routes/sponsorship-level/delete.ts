/**
 * Admin soft delete sponsorship level endpoint
 * Requires admin authentication
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    SponsorshipLevelIdSchema,
    SuccessSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipLevelService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

const sponsorshipLevelService = new SponsorshipLevelService({ logger: apiLogger });

/**
 * DELETE /api/v1/public/sponsorship-levels/:id
 * Soft delete sponsorship level - Admin endpoint
 */
export const deleteSponsorshipLevelRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete sponsorship level',
    description: 'Soft deletes a sponsorship level. Requires ADMIN role.',
    tags: ['Sponsorship Levels'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_DELETE],
    requestParams: { id: SponsorshipLevelIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await sponsorshipLevelService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

/**
 * Admin soft delete sponsorship package endpoint
 * Requires admin authentication
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    SponsorshipPackageIdSchema,
    SuccessSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipPackageService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const sponsorshipPackageService = new SponsorshipPackageService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/sponsorship-packages/:id
 * Soft delete sponsorship package - Admin endpoint
 */
export const deleteSponsorshipPackageRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete sponsorship package',
    description: 'Soft deletes a sponsorship package. Requires ADMIN role.',
    tags: ['Sponsorship Packages'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_DELETE],
    requestParams: { id: SponsorshipPackageIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await sponsorshipPackageService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

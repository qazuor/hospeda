/**
 * Admin update sponsorship package endpoint
 * Requires admin authentication
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    SponsorshipPackageIdSchema,
    SponsorshipPackageSchema,
    SponsorshipPackageUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipPackageService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const sponsorshipPackageService = new SponsorshipPackageService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/sponsorship-packages/:id
 * Update sponsorship package - Admin endpoint
 */
export const updateSponsorshipPackageRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update sponsorship package',
    description: 'Updates an existing sponsorship package. Requires ADMIN role.',
    tags: ['Sponsorship Packages'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_UPDATE],
    requestParams: { id: SponsorshipPackageIdSchema },
    requestBody: SponsorshipPackageUpdateInputSchema,
    responseSchema: SponsorshipPackageSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await sponsorshipPackageService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

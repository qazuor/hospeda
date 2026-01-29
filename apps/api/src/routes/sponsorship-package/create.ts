/**
 * Admin create sponsorship package endpoint
 * Requires admin authentication
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    SponsorshipPackageCreateInputSchema,
    SponsorshipPackageSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipPackageService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

const sponsorshipPackageService = new SponsorshipPackageService({ logger: apiLogger });

/**
 * POST /api/v1/public/sponsorship-packages
 * Create sponsorship package - Admin endpoint
 */
export const createSponsorshipPackageRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create sponsorship package',
    description: 'Creates a new sponsorship package. Requires ADMIN role.',
    tags: ['Sponsorship Packages'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_CREATE],
    requestBody: SponsorshipPackageCreateInputSchema,
    responseSchema: SponsorshipPackageSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await sponsorshipPackageService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

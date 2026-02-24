/**
 * Admin create sponsorship level endpoint
 * Requires admin authentication
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    SponsorshipLevelCreateInputSchema,
    SponsorshipLevelSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipLevelService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const sponsorshipLevelService = new SponsorshipLevelService({ logger: apiLogger });

/**
 * POST /api/v1/admin/sponsorship-levels
 * Create sponsorship level - Admin endpoint
 */
export const createSponsorshipLevelRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create sponsorship level',
    description: 'Creates a new sponsorship level. Requires ADMIN role.',
    tags: ['Sponsorship Levels'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_CREATE],
    requestBody: SponsorshipLevelCreateInputSchema,
    responseSchema: SponsorshipLevelSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await sponsorshipLevelService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

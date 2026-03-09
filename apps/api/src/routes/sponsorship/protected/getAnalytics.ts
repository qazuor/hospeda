/**
 * Protected get sponsorship analytics endpoint
 * Returns analytics data for a sponsorship
 */
import { PermissionEnum, SponsorshipAnalyticsSchema, SponsorshipIdSchema } from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * GET /api/v1/protected/sponsorships/:id/analytics
 * Get sponsorship analytics - Protected endpoint
 */
export const protectedGetSponsorshipAnalyticsRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/analytics',
    summary: 'Get sponsorship analytics',
    description:
        'Retrieves analytics data for a sponsorship. Requires SPONSORSHIP_VIEW permission.',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_VIEW],
    requestParams: { id: SponsorshipIdSchema },
    responseSchema: SponsorshipAnalyticsSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await sponsorshipService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError('NOT_FOUND', 'Sponsorship not found');
        }

        return result.data.analytics;
    }
});

/**
 * Protected create sponsorship endpoint
 * Requires authentication and SPONSORSHIP_CREATE permission
 */
import {
    PermissionEnum,
    SponsorshipCreateInputSchema,
    SponsorshipProtectedSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * POST /api/v1/protected/sponsorships
 * Create sponsorship - Protected endpoint
 */
export const protectedCreateSponsorshipRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create sponsorship',
    description: 'Creates a new sponsorship. Requires SPONSORSHIP_CREATE permission.',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_CREATE],
    requestBody: SponsorshipCreateInputSchema,
    responseSchema: SponsorshipProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await sponsorshipService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

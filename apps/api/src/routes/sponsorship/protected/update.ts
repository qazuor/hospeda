/**
 * Protected update sponsorship endpoint
 * Requires authentication and SPONSORSHIP_UPDATE permission
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    SponsorshipIdSchema,
    SponsorshipSchema,
    SponsorshipUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/sponsorships/:id
 * Update sponsorship - Protected endpoint
 */
export const protectedUpdateSponsorshipRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update sponsorship',
    description: 'Updates an existing sponsorship. Requires SPONSORSHIP_UPDATE permission.',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_UPDATE],
    requestParams: { id: SponsorshipIdSchema },
    requestBody: SponsorshipUpdateInputSchema,
    responseSchema: SponsorshipSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await sponsorshipService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

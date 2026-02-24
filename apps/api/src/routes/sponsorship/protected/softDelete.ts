/**
 * Protected soft delete sponsorship endpoint
 * Requires authentication and SPONSORSHIP_DELETE permission
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    SponsorshipIdSchema,
    SuccessSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/sponsorships/:id
 * Soft delete sponsorship - Protected endpoint
 */
export const protectedDeleteSponsorshipRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete sponsorship',
    description: 'Soft deletes a sponsorship. Requires SPONSORSHIP_DELETE permission.',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_DELETE],
    requestParams: { id: SponsorshipIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await sponsorshipService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

/**
 * Admin update sponsorship endpoint
 * Requires admin role and SPONSORSHIP_UPDATE permission.
 *
 * SPEC-117 follow-up #1: previously absent.
 */
import {
    PermissionEnum,
    SponsorshipAdminSchema,
    SponsorshipIdSchema,
    SponsorshipUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/sponsorships/:id
 */
export const adminUpdateSponsorshipRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update sponsorship (admin)',
    description: 'Updates an existing sponsorship as admin. Requires SPONSORSHIP_UPDATE.',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_UPDATE],
    requestParams: { id: SponsorshipIdSchema },
    requestBody: SponsorshipUpdateInputSchema,
    responseSchema: SponsorshipAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await sponsorshipService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * Admin soft-delete sponsorship endpoint
 * Requires admin role and SPONSORSHIP_DELETE permission.
 *
 * SPEC-117 follow-up #1: previously absent.
 */
import { PermissionEnum, SponsorshipIdSchema, SuccessSchema } from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/sponsorships/:id
 */
export const adminDeleteSponsorshipRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete sponsorship (admin)',
    description: 'Soft deletes a sponsorship as admin. Requires SPONSORSHIP_DELETE.',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_DELETE],
    requestParams: { id: SponsorshipIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await sponsorshipService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

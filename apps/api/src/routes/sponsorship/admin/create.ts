/**
 * Admin create sponsorship endpoint
 * Requires admin role and SPONSORSHIP_CREATE permission.
 *
 * SPEC-117 follow-up #1: previously absent. Admin clients were falling
 * through to /protected; now they target this admin endpoint directly.
 */
import {
    PermissionEnum,
    SponsorshipAdminSchema,
    SponsorshipCreateInputSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * POST /api/v1/admin/sponsorships
 */
export const adminCreateSponsorshipRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create sponsorship (admin)',
    description: 'Creates a new sponsorship as admin. Requires SPONSORSHIP_CREATE.',
    tags: ['Sponsorships'],
    requiredPermissions: [PermissionEnum.SPONSORSHIP_CREATE],
    requestBody: SponsorshipCreateInputSchema,
    responseSchema: SponsorshipAdminSchema,
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

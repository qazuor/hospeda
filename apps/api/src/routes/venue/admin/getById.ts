/**
 * Admin get venue listing by ID endpoint.
 * Returns full venue information including admin fields.
 */
import { PermissionEnum, VenueAdminSchema } from '@repo/schemas';
import { ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/admin/venues/:id
 * Get venue listing by ID — Admin endpoint.
 *
 * Gate requires VENUE_VIEW_ALL; the service layer additionally enforces
 * entity-level visibility (owned vs. all).
 */
export const adminGetVenueByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get venue listing by ID (admin)',
    description:
        'Retrieves full venue listing information including admin fields. Requires VENUE_VIEW_ALL.',
    tags: ['Venue'],
    anyOfPermissions: [[PermissionEnum.VENUE_VIEW_ALL]],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await venueService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? null;
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

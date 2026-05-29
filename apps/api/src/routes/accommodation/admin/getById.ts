/**
 * Admin get accommodation by ID endpoint
 * Returns full accommodation information including admin fields
 */
import { AccommodationAdminSchema, AccommodationIdSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations/:id
 * Get accommodation by ID - Admin endpoint.
 *
 * SPEC-169 §2.1/§5.2: the gate only requires admin access; the entity-specific permission
 * (ACCOMMODATION_VIEW_ALL OR ACCOMMODATION_VIEW_OWN) plus owner-scoping are enforced in the
 * service via `adminGetById` → `checkCanAdminView` (a VIEW_OWN host sees only their own; others,
 * including PUBLIC, resolve to NOT_FOUND). It deliberately does NOT use the generic `getById`,
 * whose `checkCanView` would expose any PUBLIC accommodation's admin detail to a VIEW_OWN actor.
 */
export const adminGetAccommodationByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation by ID (admin)',
    description: 'Retrieves full accommodation information including admin fields',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.adminGetById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

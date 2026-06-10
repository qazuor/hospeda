/**
 * GET /api/v1/admin/accommodations/options
 * Lightweight relation-selector lookup endpoint (SPEC-169 §5.5 / decision D4).
 */

import { AccommodationOptionsListSchema, EntityOptionsQuerySchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations/options
 * Minimal `{ id, label, slug, type, destination }` lookup for admin relation selectors.
 *
 * SPEC-169 §5.5/D4: gated by admin-panel access ONLY (no `requiredPermissions` → the admin
 * authorization middleware requires `ACCESS_PANEL_ADMIN` OR `ACCESS_API_ADMIN`). It does NOT
 * require `ACCOMMODATION_VIEW_ALL`/`_VIEW_OWN`; the service `findOptions` enforces the same
 * admin-access gate and bypasses the heavy `checkCanAdminList`. Results are DRAFT-inclusive.
 *
 * MUST be registered BEFORE the `/{id}` route so Hono does not resolve `options` as an id.
 */
export const adminAccommodationOptionsRoute = createAdminRoute({
    method: 'get',
    path: '/options',
    summary: 'Accommodation options (admin lookup)',
    description:
        'Returns lightweight {id, label, slug, type, destination} options for relation selectors. Admin-panel access only; DRAFT-inclusive.',
    tags: ['Accommodations'],
    requestQuery: EntityOptionsQuerySchema.shape,
    responseSchema: AccommodationOptionsListSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { q, limit } = (query || {}) as { q?: string; limit?: number };

        const result = await accommodationService.findOptions(actor, { q, limit });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { items: result.data?.items || [] };
    },
    options: {
        cacheTTL: 30,
        customRateLimit: { requests: 120, windowMs: 60000 }
    }
});

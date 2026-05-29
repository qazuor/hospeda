/**
 * GET /api/v1/admin/event-locations/options
 * Lightweight relation-selector lookup endpoint (SPEC-169 §5.5 / decision D4).
 */

import { EntityOptionsListSchema, EntityOptionsQuerySchema } from '@repo/schemas';
import { EventLocationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventLocationService = new EventLocationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/event-locations/options
 * Minimal `{ id, label, slug }` lookup for admin relation selectors.
 *
 * SPEC-169 §5.5/D4: gated by admin-panel access ONLY (no `requiredPermissions` → the admin
 * authorization middleware requires `ACCESS_PANEL_ADMIN` OR `ACCESS_API_ADMIN`). It does NOT
 * require a broad view grant; the service `findOptions` enforces the same admin-access gate.
 * `label` is `placeName` with a `slug` fallback (placeName is nullable — SPEC-169 §12).
 * Results are DRAFT-inclusive.
 *
 * MUST be registered BEFORE the `/{id}` route so Hono does not resolve `options` as an id.
 */
export const adminEventLocationOptionsRoute = createAdminRoute({
    method: 'get',
    path: '/options',
    summary: 'Event location options (admin lookup)',
    description:
        'Returns lightweight {id, label, slug} options for relation selectors. Admin-panel access only; DRAFT-inclusive.',
    tags: ['Event Locations'],
    requestQuery: EntityOptionsQuerySchema.shape,
    responseSchema: EntityOptionsListSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { q, limit } = (query || {}) as { q?: string; limit?: number };

        const result = await eventLocationService.findOptions(actor, { q, limit });

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

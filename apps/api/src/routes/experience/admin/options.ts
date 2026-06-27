/**
 * GET /api/v1/admin/experiences/options
 * Lightweight relation-selector lookup endpoint (mirrors gastronomy pattern).
 *
 * MUST be registered BEFORE the /{id} route so Hono does not resolve "options"
 * as a UUID param.
 *
 * NOTE: ExperienceService does not (yet) expose a dedicated `findOptions` method
 * like AccommodationService does.  This route uses `adminList` with a small page
 * and projects the result to the `ExperienceOptionsItemSchema` shape inline.
 * When a dedicated `findOptions` is added to ExperienceService, replace the
 * inline mapping with the service call.
 */
import { EntityOptionsQuerySchema, ExperienceOptionsListSchema } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/admin/experiences/options
 * Minimal `{ id, label, slug, type, destination }` lookup for admin relation selectors.
 *
 * Gated by admin-panel access only (no `requiredPermissions`).
 * Results are DRAFT-inclusive and limited to `limit` items (default 20, max 100).
 *
 * TYPE-WORKAROUND: ExperienceService lacks a dedicated `findOptions` method (unlike
 * AccommodationService). The route projects `adminList` results into the options shape.
 */
export const adminExperienceOptionsRoute = createAdminRoute({
    method: 'get',
    path: '/options',
    summary: 'Experience options (admin lookup)',
    description:
        'Returns lightweight {id, label, slug, type, destination} options for relation selectors. Admin-panel access only; DRAFT-inclusive.',
    tags: ['Experience'],
    requestQuery: EntityOptionsQuerySchema.shape,
    responseSchema: ExperienceOptionsListSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { q, limit } = (query ?? {}) as { q?: string; limit?: number };
        const resolvedLimit = Math.min(Math.max(Number(limit ?? 20), 1), 100);

        const result = await experienceService.adminList(actor, {
            search: q,
            page: 1,
            pageSize: resolvedLimit,
            includeDeleted: false
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // TYPE-WORKAROUND: adminList returns PaginatedListOutput<Experience>; project to options shape
        const items = (result.data?.items ?? []).map((e: Record<string, unknown>) => ({
            id: e.id as string,
            label: e.name as string,
            slug: e.slug as string,
            type: e.type as string,
            destination: e.destination
                ? {
                      id: (e.destination as Record<string, unknown>).id as string,
                      name: (e.destination as Record<string, unknown>).name as string,
                      slug: (e.destination as Record<string, unknown>).slug as string
                  }
                : null
        }));

        return { items };
    },
    options: {
        cacheTTL: 30,
        customRateLimit: { requests: 120, windowMs: 60000 }
    }
});

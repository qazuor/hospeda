/**
 * Admin gastronomy list endpoint
 * Returns all gastronomy listings with full admin access.
 */
import { GastronomyAdminListItemSchema, GastronomyAdminSearchSchema } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/admin/gastronomies
 * List gastronomy listings — Admin endpoint.
 *
 * Permission model: the entity-specific permission (COMMERCE_VIEW_ALL) is
 * enforced in the service (`_canAdminList` → `checkGastronomyCanAdminList`).
 * The route gate only requires admin-panel access, matching the accommodation
 * admin list pattern.
 */
export const adminListGastronomiesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List gastronomy listings (admin)',
    description: 'Returns a paginated list of gastronomy listings with full admin details',
    tags: ['Gastronomy'],
    requestQuery: GastronomyAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: GastronomyAdminListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await gastronomyService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

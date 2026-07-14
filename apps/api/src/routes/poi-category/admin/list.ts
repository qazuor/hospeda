/**
 * Admin POI-category catalog list endpoint (HOS-144 NG-1).
 *
 * HOS-143 only mounted per-POI category routes (`GET`/`PUT
 * /points-of-interest/{id}/categories`) — there was never a route to list
 * the full `poi_categories` catalog itself, which the admin panel's
 * category multi-select needs. This closes that gap by exposing the
 * catalog's own search, already implemented on
 * `PointOfInterestCategoryService` (`searchSchema`, `_executeSearch`,
 * `_executeCount`) but never mounted.
 *
 * Uses `service.search()` rather than `service.adminList()`: this service
 * does not set `adminSearchSchema` (only the catalog's own
 * `PoiCategorySearchInputSchema`), so `adminList()` would fail its
 * `adminSearchSchema` configuration check. `search()` is fully wired
 * (`_executeSearch`/`_executeCount` were added for this exact purpose) and
 * is still gated by admin auth at the route-factory layer
 * (`createAdminListRoute` → `adminAuthMiddleware` checks
 * `ACCESS_PANEL_ADMIN`/`ACCESS_API_ADMIN` before the handler runs) plus
 * `POI_CATEGORY_VIEW` at the service layer via `_canSearch`.
 */
import {
    PermissionEnum,
    PoiCategoryAdminSchema,
    type PoiCategorySearchInput,
    PoiCategorySearchInputSchema
} from '@repo/schemas';
import { PointOfInterestCategoryService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const pointOfInterestCategoryService = new PointOfInterestCategoryService({ logger: apiLogger });

/**
 * GET /api/v1/admin/poi-categories
 * List/search the full POI category catalog - Admin endpoint
 *
 * Supports `q` free-text search (against `slug`), `slug`/`lifecycleState`
 * filters, and standard `page`/`pageSize` pagination (up to 100 per page).
 */
export const adminListPoiCategoriesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all POI categories (admin)',
    description:
        'Returns a paginated list of the full POI category catalog, for use in admin category pickers.',
    tags: ['PoiCategories'],
    requiredPermissions: [PermissionEnum.POI_CATEGORY_VIEW],
    requestQuery: PoiCategorySearchInputSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: PoiCategoryAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await pointOfInterestCategoryService.search(actor, {
            ...(query as PoiCategorySearchInput),
            page,
            pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

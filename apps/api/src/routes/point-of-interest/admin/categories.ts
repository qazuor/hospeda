/**
 * Admin point-of-interest ↔ POI-category assignment routes (HOS-143 T-012).
 *
 * Mounted under `/{id}/categories` on the point-of-interest admin router.
 */
import {
    PermissionEnum,
    PoiCategoryIdSchema,
    PoiCategorySchema,
    PointOfInterestCategoryAssignmentSchema,
    PointOfInterestIdSchema
} from '@repo/schemas';
import { PointOfInterestCategoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const pointOfInterestCategoryService = new PointOfInterestCategoryService({ logger: apiLogger });

/**
 * GET /api/v1/admin/points-of-interest/:id/categories
 *
 * Lists every POI category currently assigned to a point of interest,
 * sorted by `displayWeight` descending.
 */
export const adminGetPointOfInterestCategoriesRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/categories',
    summary: 'List categories assigned to a point of interest (admin)',
    description:
        'Retrieves every POI category currently assigned to a point of interest, sorted by displayWeight descending.',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_VIEW],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    responseSchema: z.array(PoiCategorySchema),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const pointOfInterestId = params.id as string;

        const result = await pointOfInterestCategoryService.getCategoriesForPointOfInterest(
            actor,
            // page/pageSize are accepted by the schema but unused by this
            // method's execute() — it always returns the full relation set.
            { pointOfInterestId, page: 1, pageSize: 100 }
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data?.categories ?? [];
    }
});

/**
 * Body schema for the full-replace PUT below. Mirrors
 * `PointOfInterestSetCategoriesInputSchema` minus `pointOfInterestId` (which
 * comes from the path param, not the body). Cannot reuse `.omit()` on the
 * original schema directly: it's wrapped in `.refine()` (a `ZodEffects`),
 * and `ZodEffects` has no `.omit()` method — the `primaryCategoryId` ∈
 * `categoryIds` refinement is duplicated here instead, so validation still
 * fails BEFORE the handler (and thus before any write) runs (AC-5).
 *
 * Exported (not just a route-local const) so tests can exercise the
 * refinement directly via `.safeParse()` without booting the full app.
 */
export const AdminSetPointOfInterestCategoriesBodySchema = z
    .object({
        categoryIds: z
            .array(PoiCategoryIdSchema)
            .min(1, { message: 'zodError.pointOfInterest.categories.min' })
            .max(10, { message: 'zodError.pointOfInterest.categories.max' }),
        primaryCategoryId: PoiCategoryIdSchema
    })
    .refine((value) => value.categoryIds.includes(value.primaryCategoryId), {
        message: 'zodError.pointOfInterest.categories.primaryNotInSet',
        path: ['primaryCategoryId']
    });

/**
 * PUT /api/v1/admin/points-of-interest/:id/categories
 *
 * Full-replace of a POI's category set in one transactional call (HOS-143
 * T-012), including which category is primary. A single bad category id
 * fails the whole call with zero mutation (AC-6, enforced by
 * `setCategoriesForPointOfInterest` itself).
 *
 * PERMISSION DEVIATION (documented per task instructions): spec §7.5
 * nominally names `POINT_OF_INTEREST_UPDATE` for this route, but the
 * underlying service hook (`PointOfInterestCategoryService
 * ._canSetCategoriesForPointOfInterest` → `checkCanUpdatePoiCategory`)
 * actually enforces `POI_CATEGORY_UPDATE`. `createAdminRoute` gates via
 * `adminAuthMiddleware(requiredPermissions)` INSIDE `applyRouteMiddlewares`,
 * which runs BEFORE the handler (and therefore before the service) ever
 * executes — so the route-level permission and the service-level permission
 * are two independent gates in series, not one. Declaring
 * `POINT_OF_INTEREST_UPDATE` here would let an actor who has that permission
 * but NOT `POI_CATEGORY_UPDATE` pass the route gate only to be rejected by
 * the service (a confusing "phantom pass, then fail"), while an actor with
 * only `POI_CATEGORY_UPDATE` (and not `POINT_OF_INTEREST_UPDATE`) would never
 * reach the service at all. Both layers must demand the SAME permission for
 * the two gates to agree, so this route requires `POI_CATEGORY_UPDATE` — the
 * permission that actually authorizes the mutation.
 */
export const adminSetPointOfInterestCategoriesRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/categories',
    summary: 'Replace all categories assigned to a point of interest (admin)',
    description:
        "Full-replace of a point of interest's category set in one transactional call, including which category is primary.",
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POI_CATEGORY_UPDATE],
    requestParams: {
        id: PointOfInterestIdSchema
    },
    requestBody: AdminSetPointOfInterestCategoriesBodySchema,
    responseSchema: z.object({ categories: z.array(PointOfInterestCategoryAssignmentSchema) }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const pointOfInterestId = params.id as string;
        const { categoryIds, primaryCategoryId } = body as {
            categoryIds: string[];
            primaryCategoryId: string;
        };

        const result = await pointOfInterestCategoryService.setCategoriesForPointOfInterest(actor, {
            pointOfInterestId,
            categoryIds,
            primaryCategoryId
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

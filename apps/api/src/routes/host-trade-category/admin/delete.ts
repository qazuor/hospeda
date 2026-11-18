/**
 * Admin soft-delete endpoint for provider trade categories (HOS-919).
 */
import { DeleteResultSchema, HostTradeCategoryIdSchema, PermissionEnum } from '@repo/schemas';
import {
    HostTradeCategoryService,
    purgeHostTradeCategoriesCache,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const categoryService = new HostTradeCategoryService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/host-trade-categories/:id
 * Answers 409 CATEGORY_IN_USE while a non-deleted provider links the category.
 */
export const adminDeleteHostTradeCategoryRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete provider trade category',
    description:
        'Soft-deletes a category. Answers 409 CATEGORY_IN_USE while a non-deleted provider uses it; deactivate it instead.',
    tags: ['HostTradeCategories'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_DELETE],
    requestParams: { id: HostTradeCategoryIdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await categoryService.softDelete(actor, params.id as string);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        await purgeHostTradeCategoriesCache({ triggeredBy: actor.id });
        return { deleted: (result.data?.count ?? 0) > 0, id: params.id };
    }
});

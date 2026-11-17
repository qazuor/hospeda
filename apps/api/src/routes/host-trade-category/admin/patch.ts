/**
 * Admin PATCH endpoint for provider trade categories (HOS-919).
 */
import {
    HostTradeCategoryAdminSchema,
    HostTradeCategoryIdSchema,
    type HostTradeCategoryUpdateInput,
    HostTradeCategoryUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
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
 * PATCH /api/v1/admin/host-trade-categories/:id
 * The update schema is strict: a body with `slug` answers 400. Deactivating
 * (`lifecycleState: INACTIVE`) is always allowed, also while providers use it.
 */
export const adminPatchHostTradeCategoryRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update provider trade category',
    description: 'Partially updates a category. `slug` cannot be changed.',
    tags: ['HostTradeCategories'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_UPDATE],
    requestParams: { id: HostTradeCategoryIdSchema },
    requestBody: HostTradeCategoryUpdateInputSchema,
    responseSchema: HostTradeCategoryAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await categoryService.update(
            actor,
            params.id as string,
            body as HostTradeCategoryUpdateInput
        );
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        await purgeHostTradeCategoriesCache({ triggeredBy: actor.id });
        return result.data;
    }
});

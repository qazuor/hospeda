/**
 * Admin create endpoint for provider trade categories (HOS-919).
 */
import {
    HostTradeCategoryAdminSchema,
    type HostTradeCategoryCreateInput,
    HostTradeCategoryCreateInputSchema,
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
 * POST /api/v1/admin/host-trade-categories
 * Creates a category, then purges the catalog cache tag.
 */
export const adminCreateHostTradeCategoryRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create provider trade category',
    description: 'Creates a category inside an existing group. The slug is immutable afterwards.',
    tags: ['HostTradeCategories'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_CREATE],
    requestBody: HostTradeCategoryCreateInputSchema,
    responseSchema: HostTradeCategoryAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await categoryService.create(actor, body as HostTradeCategoryCreateInput);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        await purgeHostTradeCategoriesCache({ triggeredBy: actor.id });
        return result.data;
    }
});

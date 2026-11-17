/**
 * Admin get-by-id endpoint for provider trade categories (HOS-919).
 */
import {
    HostTradeCategoryAdminSchema,
    HostTradeCategoryIdSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeCategoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const categoryService = new HostTradeCategoryService({ logger: apiLogger });

/**
 * GET /api/v1/admin/host-trade-categories/:id
 */
export const adminGetHostTradeCategoryByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get provider trade category by ID (admin)',
    description: 'Retrieves a category with all admin fields.',
    tags: ['HostTradeCategories'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_VIEW],
    requestParams: { id: HostTradeCategoryIdSchema },
    responseSchema: HostTradeCategoryAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await categoryService.getById(actor, params.id as string);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});

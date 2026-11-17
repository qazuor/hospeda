/**
 * Admin restore endpoint for provider trade categories (HOS-919).
 */
import {
    HostTradeCategoryAdminSchema,
    HostTradeCategoryIdSchema,
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
 * POST /api/v1/admin/host-trade-categories/:id/restore
 */
export const adminRestoreHostTradeCategoryRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore provider trade category',
    description: 'Restores a soft-deleted category. It keeps its original slug.',
    tags: ['HostTradeCategories'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_RESTORE],
    requestParams: { id: HostTradeCategoryIdSchema },
    responseSchema: HostTradeCategoryAdminSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const restored = await categoryService.restore(actor, id);
        if (restored.error) throw new ServiceError(restored.error.code, restored.error.message);
        await purgeHostTradeCategoriesCache({ triggeredBy: actor.id });
        const fetched = await categoryService.getById(actor, id);
        if (fetched.error) throw new ServiceError(fetched.error.code, fetched.error.message);
        return fetched.data;
    }
});

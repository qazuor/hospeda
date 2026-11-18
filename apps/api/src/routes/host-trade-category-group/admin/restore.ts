/**
 * Admin restore endpoint for provider trade category groups (HOS-919).
 */
import {
    HostTradeCategoryGroupAdminSchema,
    HostTradeCategoryGroupIdSchema,
    PermissionEnum
} from '@repo/schemas';
import {
    HostTradeCategoryGroupService,
    purgeHostTradeCategoriesCache,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const groupService = new HostTradeCategoryGroupService({ logger: apiLogger });

/**
 * POST /api/v1/admin/host-trade-category-groups/:id/restore
 */
export const adminRestoreHostTradeCategoryGroupRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore provider trade category group',
    description: 'Restores a soft-deleted group. It keeps its original slug.',
    tags: ['HostTradeCategoryGroups'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_RESTORE],
    requestParams: { id: HostTradeCategoryGroupIdSchema },
    responseSchema: HostTradeCategoryGroupAdminSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const restored = await groupService.restore(actor, id);
        if (restored.error) throw new ServiceError(restored.error.code, restored.error.message);
        await purgeHostTradeCategoriesCache({ triggeredBy: actor.id });
        const fetched = await groupService.getById(actor, id);
        if (fetched.error) throw new ServiceError(fetched.error.code, fetched.error.message);
        return fetched.data;
    }
});

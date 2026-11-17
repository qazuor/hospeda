/**
 * Admin soft-delete endpoint for provider trade category groups (HOS-919).
 */
import { DeleteResultSchema, HostTradeCategoryGroupIdSchema, PermissionEnum } from '@repo/schemas';
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
 * DELETE /api/v1/admin/host-trade-category-groups/:id
 * Answers 409 CATEGORY_IN_USE while the group still has live categories.
 */
export const adminDeleteHostTradeCategoryGroupRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete provider trade category group',
    description:
        'Soft-deletes a group. Answers 409 CATEGORY_IN_USE while it has non-deleted categories.',
    tags: ['HostTradeCategoryGroups'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_DELETE],
    requestParams: { id: HostTradeCategoryGroupIdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await groupService.softDelete(actor, params.id as string);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        await purgeHostTradeCategoriesCache({ triggeredBy: actor.id });
        return { deleted: (result.data?.count ?? 0) > 0, id: params.id };
    }
});

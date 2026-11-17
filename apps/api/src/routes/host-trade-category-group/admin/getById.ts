/**
 * Admin get-by-id endpoint for provider trade category groups (HOS-919).
 */
import {
    HostTradeCategoryGroupAdminSchema,
    HostTradeCategoryGroupIdSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeCategoryGroupService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const groupService = new HostTradeCategoryGroupService({ logger: apiLogger });

/**
 * GET /api/v1/admin/host-trade-category-groups/:id
 */
export const adminGetHostTradeCategoryGroupByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get provider trade category group by ID (admin)',
    description: 'Retrieves a category group with all admin fields.',
    tags: ['HostTradeCategoryGroups'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_VIEW],
    requestParams: { id: HostTradeCategoryGroupIdSchema },
    responseSchema: HostTradeCategoryGroupAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await groupService.getById(actor, params.id as string);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});

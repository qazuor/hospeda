/**
 * Admin create endpoint for provider trade category groups (HOS-919).
 */
import {
    HostTradeCategoryGroupAdminSchema,
    type HostTradeCategoryGroupCreateInput,
    HostTradeCategoryGroupCreateInputSchema,
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
 * POST /api/v1/admin/host-trade-category-groups
 * Creates a group, then purges the catalog cache tag.
 */
export const adminCreateHostTradeCategoryGroupRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create provider trade category group',
    description: 'Creates a category group. The slug is immutable afterwards.',
    tags: ['HostTradeCategoryGroups'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_CREATE],
    requestBody: HostTradeCategoryGroupCreateInputSchema,
    responseSchema: HostTradeCategoryGroupAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await groupService.create(actor, body as HostTradeCategoryGroupCreateInput);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        await purgeHostTradeCategoriesCache({ triggeredBy: actor.id });
        return result.data;
    }
});

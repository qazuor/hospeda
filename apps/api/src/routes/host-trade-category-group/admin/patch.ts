/**
 * Admin PATCH endpoint for provider trade category groups (HOS-919).
 */
import {
    HostTradeCategoryGroupAdminSchema,
    HostTradeCategoryGroupIdSchema,
    type HostTradeCategoryGroupUpdateInput,
    HostTradeCategoryGroupUpdateInputSchema,
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
 * PATCH /api/v1/admin/host-trade-category-groups/:id
 * The update schema is strict: a body with `slug` answers 400.
 */
export const adminPatchHostTradeCategoryGroupRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update provider trade category group',
    description: 'Partially updates a category group. `slug` cannot be changed.',
    tags: ['HostTradeCategoryGroups'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_UPDATE],
    requestParams: { id: HostTradeCategoryGroupIdSchema },
    requestBody: HostTradeCategoryGroupUpdateInputSchema,
    responseSchema: HostTradeCategoryGroupAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await groupService.update(
            actor,
            params.id as string,
            body as HostTradeCategoryGroupUpdateInput
        );
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        await purgeHostTradeCategoriesCache({ triggeredBy: actor.id });
        return result.data;
    }
});

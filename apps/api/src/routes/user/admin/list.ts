/**
 * Admin user list endpoint
 * Returns all users with full admin access
 */
import {
    PermissionEnum,
    type ServiceErrorCode,
    UserAdminSchema,
    UserAdminSearchSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * GET /api/v1/admin/users
 * List all users - Admin endpoint
 * Admin permissions allow viewing all users via service-level checks
 */
export const adminListUsersRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all users (admin)',
    description: 'Returns a paginated list of all users with full admin details',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_READ_ALL],
    requestQuery: UserAdminSearchSchema.shape,
    responseSchema: UserAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await userService.list(actor, { ...query });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

/**
 * Admin user list endpoint
 * Returns all users with full admin access
 */
import { type ServiceErrorCode, UserAdminSchema, UserSearchHttpSchema } from '@repo/schemas';
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
    requestQuery: UserSearchHttpSchema.shape,
    responseSchema: UserAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Use list method with pagination
        // Admin actor permissions allow full access at service level
        const result = await userService.list(actor, { page, pageSize });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

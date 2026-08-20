/**
 * Protected get user by ID endpoint
 * Allows users to view their own full profile or public info of others
 */
import { PermissionEnum, UserIdSchema, UserSelfSchema } from '@repo/schemas';
import { entityNotFoundError, ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * GET /api/v1/protected/users/:id
 * Get user by ID - Protected endpoint
 * Users can only view their own profile unless they have USER_READ_ALL permission
 */
export const protectedGetUserByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get user by ID',
    description: 'Retrieves user information. Users can only view their own profile.',
    tags: ['Users'],
    requestParams: {
        id: UserIdSchema
    },
    // UserSelfSchema (not UserProtectedSchema): this route is self-scoped, so the
    // response must include the contactInfo/location/socialNetworks JSONB blobs
    // the edit-profile form rehydrates from. See UserSelfSchema JSDoc.
    responseSchema: UserSelfSchema.nullable(),
    // Ownership is enforced HERE, before the row is fetched, and again by
    // UserService._canView() for every other caller of the service.
    // No ownership middleware needed here (the user entity has no 'userId' field to match on)
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const requestedId = params.id as string;

        // HOS-600. The contract orders the checks permission → existence, and
        // running them in that order is what closes the oracle: an id that is
        // not the caller's own and that they hold no USER_READ_ALL for is
        // answered WITHOUT asking the database at all, so "real account",
        // "deleted account" and "no such id" cannot be told apart by the body,
        // by the status, or by how long the answer took. `_canView` would also
        // reject, but only after a row had already been read.
        if (
            requestedId !== actor.id &&
            !actor.permissions?.includes(PermissionEnum.USER_READ_ALL)
        ) {
            throw entityNotFoundError({ entityName: UserService.ENTITY_NAME });
        }

        const result = await userService.getById(actor, requestedId);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

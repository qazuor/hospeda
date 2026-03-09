/**
 * Protected patch user endpoint
 * Allows users to partially update their own profile
 */
import { UserIdSchema, UserPatchInputSchema, UserProtectedSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createProtectedRoute } from '../../../utils/route-factory';
import { userCache } from '../../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/users/:id
 * Partial update user - Protected endpoint
 * Users can only update their own profile
 */
export const protectedPatchUserRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update user',
    description:
        'Updates specific fields of user profile. Users can only update their own profile.',
    tags: ['Users'],
    requestParams: { id: UserIdSchema },
    requestBody: UserPatchInputSchema,
    responseSchema: UserProtectedSchema,
    // Ownership is enforced by UserService._canUpdate() which checks actor.id === entity.id
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        // Transform API input (string dates) to domain format (Date objects)
        const domainInput = transformApiInputToDomain(body);

        const result = await userService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Invalidate cache for the updated user
        if (result.data?.id) {
            userCache.invalidate(result.data.id);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});

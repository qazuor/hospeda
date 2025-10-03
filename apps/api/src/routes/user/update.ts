/**
 * Example endpoint showing how to use ResponseFactory.createCRUDResponses
 * This demonstrates the proper usage of the response factory in a real endpoint
 */

import { z } from '@hono/zod-openapi';
import { RoleEnum, UserSchema } from '@repo/schemas';
import { UserService } from '@repo/service-core';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';
import { userCache } from '../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

/**
 * Example: Update user endpoint using ResponseFactory
 */
export const updateUserRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update user',
    description: 'Updates an existing user',
    tags: ['Users'],
    requestParams: {
        id: z.string().min(3).describe('User ID')
    },
    requestBody: z.object({
        firstName: z.string().min(2).optional(),
        lastName: z.string().min(2).optional(),
        displayName: z.string().min(2).optional(),
        role: z.nativeEnum(RoleEnum).optional()
    }),
    responseSchema: UserSchema,
    handler: async (ctx, params, body) => {
        const { id } = params;
        const userData = body as {
            firstName?: string;
            lastName?: string;
            displayName?: string;
            role?: RoleEnum;
        };

        // Get actor from context (assuming it's set by auth middleware)
        const actor = ctx.get('actor');

        // Call the real user service
        const result = await userService.update(actor, id as string, userData);

        if (result.error) {
            throw new Error(result.error.message);
        }

        // Invalidate cache for the updated user
        // Note: We need to find the user's Clerk ID to invalidate properly
        // For now, we'll invalidate all cache as a simple solution
        // TODO [a78bd16f-4cc9-42f7-92de-2a9d6e043e8c]: Improve this by storing Clerk ID mapping or adding a method to get Clerk ID by user ID
        if (result.data?.authProviderUserId) {
            userCache.invalidate(result.data.authProviderUserId);
        }

        return result.data;
    }
});

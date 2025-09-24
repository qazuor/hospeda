/**
 * Example endpoint showing how to use ResponseFactory.createCRUDResponses
 * This demonstrates the proper usage of the response factory in a real endpoint
 */

import { z } from '@hono/zod-openapi';
import { UserSchema } from '@repo/schemas';
import { UserService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * Example: Get user by ID endpoint using ResponseFactory
 */
export const getUserByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get user by ID',
    description: 'Retrieves a user by their ID',
    tags: ['Users'],
    requestParams: {
        id: z.string().min(3).describe('User ID')
    },
    responseSchema: UserSchema,
    handler: async (ctx, params) => {
        const { id } = params;

        // Get actor from context
        const actor = getActorFromContext(ctx);

        // Call the real user service
        const result = await userService.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

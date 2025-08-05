/**
 * Example endpoint showing how to use ResponseFactory.createCRUDResponses
 * This demonstrates the proper usage of the response factory in a real endpoint
 */

import { z } from '@hono/zod-openapi';
import { UserService } from '@repo/service-core';
import type { UserId } from '@repo/types';
import { RoleEnum } from '@repo/types';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';
import { UserSchema } from './schemas';

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
        const result = await userService.update(actor, id as string, {
            id: id as UserId,
            ...userData
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});

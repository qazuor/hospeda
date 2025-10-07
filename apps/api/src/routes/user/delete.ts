/**
 * Example endpoint showing how to use ResponseFactory.createCRUDResponses
 * This demonstrates the proper usage of the response factory in a real endpoint
 */

import { DeleteResultSchema, UserIdSchema } from '@repo/schemas';
import { UserService } from '@repo/service-core';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * Example: Delete user endpoint using ResponseFactory
 */
export const deleteUserRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete user',
    description: 'Deletes a user',
    tags: ['Users'],
    requestParams: {
        id: UserIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx, params) => {
        const { id } = params;

        // Get actor from context (assuming it's set by auth middleware)
        const actor = ctx.get('actor');

        // Call the real user service
        const result = await userService.softDelete(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});

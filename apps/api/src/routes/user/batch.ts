import {
    type UserBatchRequest,
    UserBatchRequestSchema,
    UserBatchResponseSchema
} from '@repo/schemas';
import { UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

export const userBatchRoute = createCRUDRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple users by IDs',
    description: 'Retrieves multiple users by their IDs for entity select components',
    tags: ['Users'],
    requestBody: UserBatchRequestSchema,
    responseSchema: UserBatchResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as UserBatchRequest;

        // Load all users by their IDs
        const users = await Promise.all(
            ids.map(async (id) => {
                const result = await userService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and displayName/firstName/lastName for entity selectors to work
            const requiredFields = ['id', 'displayName', 'firstName', 'lastName'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return users.map((user) => {
                if (!user) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in user) {
                        filtered[field] = user[field as keyof typeof user];
                    }
                }

                return filtered;
            });
        }

        // Return just the array - createCRUDRoute will wrap it with success, data, metadata
        return users;
    },
    options: {
        skipAuth: true,
        skipValidation: false,
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});

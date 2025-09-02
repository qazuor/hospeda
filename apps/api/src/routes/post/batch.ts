import { PostDetailSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * Request schema for batch post loading
 */
const BatchPostRequestSchema = z.object({
    ids: z.array(z.string()).min(1).max(100), // Limit to 100 IDs per request
    fields: z.array(z.string()).optional() // Optional field selection
});

/**
 * Response schema for batch post loading
 */
const BatchPostResponseSchema = z.array(PostDetailSchema.nullable());

export const postBatchRoute = createCRUDRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple posts by IDs',
    description: 'Retrieves multiple posts by their IDs for entity select components',
    tags: ['Posts'],
    requestBody: BatchPostRequestSchema,
    responseSchema: BatchPostResponseSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        // Load all posts by their IDs
        const posts = await Promise.all(
            ids.map(async (id) => {
                const result = await postService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and title for entity selectors to work
            const requiredFields = ['id', 'title'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return posts.map((post) => {
                if (!post) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in post) {
                        filtered[field] = post[field as keyof typeof post];
                    }
                }

                return filtered;
            });
        }

        // Return just the array - createCRUDRoute will wrap it with success, data, metadata
        return posts;
    },
    options: {
        skipAuth: true,
        skipValidation: false,
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});

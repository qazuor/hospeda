/**
 * Admin batch tag endpoint
 * Retrieves multiple tags by IDs
 */
import { type TagBatchRequest, TagBatchRequestSchema, TagBatchResponseSchema } from '@repo/schemas';
import { TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * POST /api/v1/admin/tags/batch
 * Get multiple tags by IDs - Admin endpoint
 */
export const adminBatchTagsRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple tags by IDs',
    description: 'Retrieves multiple tags by their IDs for entity select components',
    tags: ['Tags'],
    requestBody: TagBatchRequestSchema,
    responseSchema: TagBatchResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as TagBatchRequest;

        // Load all tags by their IDs
        const tags = await Promise.all(
            ids.map(async (id) => {
                const result = await tagService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and name for entity selectors to work
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return tags.map((tag) => {
                if (!tag) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in tag) {
                        filtered[field] = tag[field as keyof typeof tag];
                    }
                }

                return filtered;
            });
        }

        return tags;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});

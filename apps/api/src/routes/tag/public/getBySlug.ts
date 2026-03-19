import { z } from '@hono/zod-openapi';
/**
 * Public tag by slug endpoint
 * Returns a single tag by its URL slug
 */
import { ServiceErrorCode, TagSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * Public response schema for tag - only exposes safe public fields
 */
const TagPublicResponseSchema = TagSchema.pick({
    id: true,
    name: true,
    slug: true
});

/**
 * GET /api/v1/public/tags/by-slug/:slug
 * Get tag by slug - Public endpoint
 */
export const publicGetTagBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/by-slug/{slug}',
    summary: 'Get tag by slug',
    description: 'Retrieves a tag by its unique URL slug. Returns id, name, and slug fields.',
    tags: ['Tags'],
    requestParams: {
        slug: z.string().min(1).max(100).openapi({ description: 'Tag URL slug' })
    },
    responseSchema: TagPublicResponseSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const slug = params.slug as string;

        const result = await tagService.getBySlug(actor, slug);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Tag with slug "${slug}" not found`);
        }

        return {
            id: result.data.id,
            name: result.data.name,
            slug: result.data.slug
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

/**
 * Public PostTag list endpoint
 *
 * Returns all ACTIVE PostTags for anonymous visitors.
 * Supports `?withCounts=true` to include usage counts per tag.
 * Sets `Cache-Control: public, max-age=600` on the response (D-013, AC-F24).
 *
 * @see SPEC-086 D-013, AC-F13, AC-F24
 */
import { PostTagService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { apiLogger } from '../../../../utils/logger';
import { createPublicRoute } from '../../../../utils/route-factory';

const postTagService = new PostTagService({ logger: apiLogger });

/**
 * Query param: coerce the query-string value to boolean.
 * Accepts 'true'/'1' as true, everything else as false.
 * Default: false.
 */
const ListQuerySchema = z.object({
    withCounts: z
        .string()
        .optional()
        .transform((val) => val === 'true' || val === '1')
        .pipe(z.boolean())
        .default(false)
});

/**
 * Public PostTag item schema (without audit fields).
 */
const PublicPostTagItemSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    color: z.string(),
    icon: z.string().nullable().optional(),
    lifecycleState: z.string(),
    description: z.string().nullable().optional()
});

/**
 * Public PostTag item with usage count.
 */
const PublicPostTagWithCountSchema = PublicPostTagItemSchema.extend({
    usageCount: z.number().int().nonnegative().optional()
});

/**
 * GET /api/v1/public/posts/tags
 * List ACTIVE PostTags — Public endpoint (no auth required)
 *
 * No pagination — realistic volume is 50–200 PostTags (D-013).
 * Returns `Cache-Control: public, max-age=600` (10 minutes) to enable
 * downstream CDN/proxy caching and satisfy AC-F24.
 */
export const publicListPostTagsRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'List ACTIVE PostTags (public)',
    description:
        'Returns all ACTIVE PostTags for public consumption. No pagination. Optionally includes usageCount per tag when ?withCounts=true.',
    tags: ['PostTags'],
    requestQuery: ListQuerySchema.shape,
    responseSchema: z.array(PublicPostTagWithCountSchema),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        // Set Cache-Control header for AC-F24 (D-013)
        ctx.header('Cache-Control', 'public, max-age=600');

        const withCounts = query?.withCounts === true || query?.withCounts === 'true';

        const result = await postTagService.listPublic(withCounts);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? [];
    },
    options: {
        cacheTTL: 600, // 10 minutes — matches Cache-Control header
        customRateLimit: { requests: 300, windowMs: 60000 }
    }
});

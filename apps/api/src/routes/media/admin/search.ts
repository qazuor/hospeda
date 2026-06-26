import { PermissionEnum } from '@repo/schemas';
import { ImageSearchService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { env } from '../../../utils/env';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

const SearchResultSchema = z.object({
    providerId: z.string().min(1),
    provider: z.enum(['unsplash', 'pexels']),
    thumbUrl: z.string().url(),
    fullUrl: z.string().url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    photographer: z.string().min(1),
    photographerUrl: z.string().url(),
    downloadLocation: z.string().url().optional()
});

const SearchResponseSchema = z.object({
    results: z.array(SearchResultSchema)
});

export const adminSearchStockMediaRoute = createAdminRoute({
    method: 'get',
    path: '/search',
    summary: 'Search stock images',
    description:
        'Searches Unsplash or Pexels and returns normalized image results for the admin editor.',
    tags: ['Media'],
    requiredPermissions: [PermissionEnum.MEDIA_UPLOAD],
    requestQuery: {
        provider: z.enum(['unsplash', 'pexels']),
        query: z.string().min(1),
        orientation: z.enum(['landscape', 'portrait', 'squarish']).optional(),
        page: z.coerce.number().int().min(1).optional(),
        perPage: z.coerce.number().int().min(1).max(30).optional()
    },
    responseSchema: SearchResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        if (!env.HOSPEDA_UNSPLASH_ACCESS_KEY || !env.HOSPEDA_PEXELS_API_KEY) {
            return createErrorResponse(
                {
                    code: 'PROVIDER_UNCONFIGURED',
                    message: 'Stock image providers are not configured'
                },
                ctx,
                503
            );
        }

        const service = new ImageSearchService({
            unsplashAccessKey: env.HOSPEDA_UNSPLASH_ACCESS_KEY,
            pexelsApiKey: env.HOSPEDA_PEXELS_API_KEY
        });

        const results = await service.search({
            provider: query?.provider as 'unsplash' | 'pexels',
            query: String(query?.query ?? ''),
            orientation: query?.orientation as 'landscape' | 'portrait' | 'squarish' | undefined,
            page: query?.page as number | undefined,
            perPage: query?.perPage as number | undefined
        });

        return { results };
    },
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: 30,
                keyPrefix: 'media:stock-search'
            })
        ]
    }
});

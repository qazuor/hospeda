import { z } from '@hono/zod-openapi';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const searchQuerySchema = {
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    pageSize: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
    name: z.string().optional(),
    slug: z.string().optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    isBuiltin: z.enum(['true', 'false']).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    q: z.string().optional()
};

export const searchFeaturesRoute = createListRoute({
    method: 'get',
    path: '/features/search',
    summary: 'Search features',
    description: 'Search features by filters and pagination',
    tags: ['Features'],
    requestQuery: searchQuerySchema,
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const q = query as {
            page?: number;
            pageSize?: number;
            name?: string;
            slug?: string;
            isFeatured?: 'true' | 'false';
            isBuiltin?: 'true' | 'false';
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
            q?: string;
        };
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.search(actor, {
            // This matches the SearchFeatureSchema (service expects these fields at root)
            name: q.name,
            slug: q.slug,
            isFeatured: q.isFeatured ? q.isFeatured === 'true' : undefined,
            isBuiltin: q.isBuiltin ? q.isBuiltin === 'true' : undefined
        } as unknown as Record<string, unknown>);
        if ((result as { error?: { message: string } }).error)
            throw new Error((result as { error: { message: string } }).error.message);
        return {
            items: (result as { data: { items: unknown[]; total: number } }).data.items,
            pagination: {
                page,
                limit: pageSize,
                total: (result as { data: { items: unknown[]; total: number } }).data.total,
                totalPages: Math.ceil(
                    (result as { data: { items: unknown[]; total: number } }).data.total / pageSize
                )
            }
        };
    }
});

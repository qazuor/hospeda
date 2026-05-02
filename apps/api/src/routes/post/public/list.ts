/**
 * Public post list endpoint
 * Returns paginated list of public posts.
 *
 * Sorting:
 * - `sortBy`/`sortOrder`: single-column sort whitelisted via {@link sanitizeSortBy}.
 *   Allowed fields: title, publishedAt, createdAt, isFeatured, mostSaved.
 * - `mostSaved` is a synthetic field backed by a correlated subquery against
 *   `user_bookmarks` (entity_type='POST'). See SPEC-098 T-052b and the
 *   `PostModel.findAll` override for details.
 */
import { type HttpPostSearch, PostPublicSchema, PostSearchHttpSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * Allowed sort fields for the public post list.
 *
 * `mostSaved` is a synthetic field backed by a correlated subquery against
 * `user_bookmarks`. It depends on the compound index
 * `idx_user_bookmarks_entity_active` on `(entity_id, entity_type, deleted_at)`
 * (see SPEC-098 T-008 and `0019_user_bookmarks_entity_active_index.sql`).
 *
 * Other fields map directly to post table columns.
 */
const ALLOWED_SORT_FIELDS = new Set([
    'title',
    'publishedAt',
    'createdAt',
    'isFeatured',
    'mostSaved'
]);

/**
 * Validates the sortBy field against the allowed public sort columns.
 * Returns undefined if the field is not in the allow-list to prevent
 * sorting on internal or sensitive columns.
 */
export function sanitizeSortBy(sortBy: string | undefined): string | undefined {
    if (sortBy && ALLOWED_SORT_FIELDS.has(sortBy)) {
        return sortBy;
    }
    return undefined;
}

/**
 * GET /api/v1/public/posts
 * List posts - Public endpoint
 */
export const publicListPostsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List posts',
    description: 'Returns a paginated list of public posts',
    tags: ['Posts'],
    requestQuery: PostSearchHttpSchema.shape,
    responseSchema: PostPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const httpParams = (query ?? {}) as HttpPostSearch;
        const safeSortBy = sanitizeSortBy(httpParams.sortBy);

        const result = await postService.search(actor, {
            ...httpParams,
            page,
            pageSize,
            sortBy: safeSortBy,
            sortOrder: safeSortBy ? (httpParams.sortOrder ?? 'asc') : undefined
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

/**
 * Public event list endpoint
 * Returns paginated list of public events.
 *
 * Sorting:
 * - `sortBy`/`sortOrder`: single-column sort whitelisted via {@link sanitizeSortBy}.
 *   Allowed fields: name, createdAt, isFeatured, mostSaved.
 * - `mostSaved` is a synthetic field backed by a correlated subquery against
 *   `user_bookmarks` (entity_type='EVENT'). See SPEC-098 T-052a and the
 *   `EventModel.findAll` override for details.
 */
import { EventPublicSchema, EventSearchHttpSchema, type HttpEventSearch } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * Allowed sort fields for the public event list.
 *
 * `mostSaved` is a synthetic field backed by a correlated subquery against
 * `user_bookmarks`. It depends on the compound index
 * `idx_user_bookmarks_entity_active` on `(entity_id, entity_type, deleted_at)`
 * (see SPEC-098 T-008 and `0019_user_bookmarks_entity_active_index.sql`).
 *
 * Other fields map directly to event table columns. `startDate` is intentionally
 * excluded — `events.date` is a JSONB column and would not order correctly
 * without a dedicated extractor; if/when needed, add it as a synthetic sort.
 */
const ALLOWED_SORT_FIELDS = new Set([
    'name',
    'createdAt',
    'isFeatured',
    'mostSaved',
    // Synthetic sort: orders by `events.date->>'start'` (JSONB extraction)
    // via the EventModel.findAllWithRelations override. NULL dates land last.
    'startDate'
]);

/**
 * Validates the sortBy field against the allowed public sort columns.
 * Returns undefined if the field is not in the allow-list to prevent
 * sorting on internal or sensitive columns.
 */
function sanitizeSortBy(sortBy: string | undefined): string | undefined {
    if (sortBy && ALLOWED_SORT_FIELDS.has(sortBy)) {
        return sortBy;
    }
    return undefined;
}

/**
 * GET /api/v1/public/events
 * List events - Public endpoint
 */
export const publicListEventsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List events',
    description: 'Returns a paginated list of public events',
    tags: ['Events'],
    requestQuery: EventSearchHttpSchema.shape,
    responseSchema: EventPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const httpParams = (query ?? {}) as HttpEventSearch;
        const safeSortBy = sanitizeSortBy(httpParams.sortBy);

        const result = await eventService.search(actor, {
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

/**
 * Public destination list endpoint
 * Returns paginated list of public destinations
 */
import {
    DestinationPublicSchema,
    type DestinationSearchHttp,
    DestinationSearchHttpSchema,
    httpToDomainDestinationSearch
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * In-memory cache for event counts by city.
 * Avoids re-querying all events on every request.
 * TTL: 10 minutes (longer than route cache to reduce DB pressure).
 */
const EVENT_COUNT_CACHE_TTL_MS = 10 * 60 * 1000;
let eventCountCache: { readonly map: Map<string, number>; readonly expiresAt: number } | null =
    null;

/** Mutex flag to prevent concurrent cache rebuilds under load */
let eventCountCacheRefreshing = false;

/** Subset of the embedded EventLocation projection we read for counting. */
interface EventLocationProjection {
    readonly destinationId?: string;
}

/**
 * Build or return cached event-count map keyed by `destinationId`.
 *
 * Post SPEC-095 the event location no longer carries a flat `city` string;
 * the geographic dimension is the FK `destinationId` to a CITY destination,
 * so destination cards count events by joining on that id.
 */
async function getEventCountsByDestination(
    actor: Parameters<InstanceType<typeof import('@repo/service-core').EventService>['search']>[0]
): Promise<Map<string, number>> {
    const now = Date.now();
    if (eventCountCache && eventCountCache.expiresAt > now) {
        return eventCountCache.map;
    }

    /* If another request is already rebuilding the cache, return stale data or empty map */
    if (eventCountCacheRefreshing) {
        return eventCountCache?.map ?? new Map<string, number>();
    }

    eventCountCacheRefreshing = true;

    try {
        const { EventService } = await import('@repo/service-core');
        const eventService = new EventService({ logger: apiLogger });

        const map = new Map<string, number>();

        /* Paginate through all events in batches */
        const PAGE_SIZE = 100;
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const batch = await eventService.search(actor, { pageSize: PAGE_SIZE, page });
            const items = batch.data?.items ?? [];

            for (const evt of items) {
                const evtLocation = (evt as { readonly location?: EventLocationProjection })
                    .location;
                const destinationId = evtLocation?.destinationId;
                if (destinationId) {
                    map.set(destinationId, (map.get(destinationId) ?? 0) + 1);
                }
            }

            hasMore = items.length === PAGE_SIZE;
            page++;

            /* Safety limit: max 10 pages (1000 events) to prevent runaway queries */
            if (page > 10) break;
        }

        eventCountCache = { map, expiresAt: now + EVENT_COUNT_CACHE_TTL_MS };
        return map;
    } finally {
        eventCountCacheRefreshing = false;
    }
}

/**
 * GET /api/v1/public/destinations
 * List destinations - Public endpoint
 */
export const publicListDestinationsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List destinations',
    description: 'Returns a paginated list of public destinations',
    tags: ['Destinations'],
    requestQuery: DestinationSearchHttpSchema.shape,
    responseSchema: DestinationPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const safeQuery = query || {};

        // Convert HTTP query params to domain search input via the canonical converter.
        // This handles all filter fields including hierarchy, location, and boolean coercion.
        const domainParams = httpToDomainDestinationSearch(safeQuery as DestinationSearchHttp);

        const result = await destinationService.search(actor, {
            ...domainParams,
            page,
            pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Enrich with attractions (batch query via junction table)
        // biome-ignore lint/suspicious/noExplicitAny: enrichment adds fields not in base type
        let items: any[] = [...(result.data?.items || [])];
        if (items.length > 0) {
            try {
                const destIds = items.map((item: { readonly id: string }) => item.id);
                const attractionsMap = await destinationService.getAttractionsMap(destIds);
                items = items.map((item: { readonly id: string }) => {
                    return { ...item, attractions: attractionsMap.get(item.id) ?? [] };
                });
            } catch {
                // Silently continue without attractions if query fails
            }
        }

        // Enrich with eventsCount when requested (cached map keyed by destinationId)
        if (safeQuery.includeEventCount && items.length > 0) {
            try {
                const eventsByDestination = await getEventCountsByDestination(actor);
                items = items.map((item) => {
                    const dest = item as { readonly id?: string };
                    const count = dest.id ? (eventsByDestination.get(dest.id) ?? 0) : 0;
                    return { ...item, eventsCount: count };
                });
            } catch {
                // Silently continue without event counts if query fails
            }
        }

        return {
            items,
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

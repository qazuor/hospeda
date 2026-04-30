import { fetchApi } from '@/lib/api/client';
import type { Tag } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';

/**
 * Query key factory for entity attribution queries.
 * Provides a consistent key structure for TanStack Query cache management.
 */
export const entityAttributionQueryKeys = {
    all: ['entity-attribution'] as const,
    entity: (type: string, id: string) => [...entityAttributionQueryKeys.all, type, id] as const
};

/** Single assignment row returned by the attribution endpoint. */
export interface EntityTagAssignment {
    readonly tagId: string;
    readonly tag: Tag;
    readonly assignedById: string;
    readonly assignedByDisplayName?: string;
    readonly assignedByEmail?: string;
    readonly assignedAt: string;
}

/** Shape of the entity attribution API response. */
interface EntityAttributionResponse {
    readonly success: boolean;
    readonly data: {
        readonly assignments: EntityTagAssignment[];
    };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchEntityAttribution(type: string, id: string) {
    const result = await fetchApi<EntityAttributionResponse>({
        path: `/api/v1/admin/entities/${type}/${id}/tags`
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches all tag assignments for a given entity, including attribution metadata.
 *
 * Gate: caller must have `TAG_VIEW_ALL_ASSIGNMENTS` permission.
 *
 * @param entityType - Entity type string (e.g., 'accommodation', 'event')
 * @param entityId - UUID of the entity
 */
export function useEntityAttribution(entityType: string, entityId: string) {
    return useQuery({
        queryKey: entityAttributionQueryKeys.entity(entityType, entityId),
        queryFn: () => fetchEntityAttribution(entityType, entityId),
        enabled: !!entityType && !!entityId,
        staleTime: 30_000
    });
}

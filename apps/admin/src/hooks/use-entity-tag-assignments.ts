import { fetchApi } from '@/lib/api/client';
import type { Tag } from '@repo/schemas';
import type { EntityTypeEnum } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query key factory for entity tag assignment queries.
 */
export const entityTagQueryKeys = {
    all: ['entity-tags'] as const,
    assignments: (entityType: EntityTypeEnum, entityId: string) =>
        [...entityTagQueryKeys.all, 'assignments', entityType, entityId] as const
};

/** Shape of entity tag list API response. */
interface EntityTagListResponse {
    readonly success: boolean;
    readonly data: Tag[];
}

/** Shape of assign/remove response. */
interface EntityTagMutationResponse {
    readonly success: boolean;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchEntityTagAssignments(entityType: EntityTypeEnum, entityId: string) {
    const result = await fetchApi<EntityTagListResponse>({
        path: `/api/v1/admin/entities/${entityType}/${entityId}/tags`
    });
    return result.data.data;
}

async function assignTagToEntity(entityType: EntityTypeEnum, entityId: string, tagId: string) {
    await fetchApi<EntityTagMutationResponse>({
        path: `/api/v1/admin/entities/${entityType}/${entityId}/tags`,
        method: 'POST',
        body: { tagId }
    });
}

async function removeTagFromEntity(entityType: EntityTypeEnum, entityId: string, tagId: string) {
    await fetchApi<EntityTagMutationResponse>({
        path: `/api/v1/admin/entities/${entityType}/${entityId}/tags/${tagId}`,
        method: 'DELETE'
    });
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the current actor's own tag assignments on a specific entity.
 *
 * @param entityType - Entity type (EntityTypeEnum)
 * @param entityId - Entity UUID
 * @param enabled - Whether to run the query (default true)
 */
export function useEntityTagAssignments(
    entityType: EntityTypeEnum,
    entityId: string,
    enabled = true
) {
    return useQuery({
        queryKey: entityTagQueryKeys.assignments(entityType, entityId),
        queryFn: () => fetchEntityTagAssignments(entityType, entityId),
        enabled: !!entityId && enabled,
        staleTime: 30_000
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Mutation to assign a tag to an entity.
 * Uses optimistic updates and invalidates assignment cache on success.
 *
 * @param entityType - Entity type (EntityTypeEnum)
 * @param entityId - Entity UUID
 */
export function useAssignTag(entityType: EntityTypeEnum, entityId: string) {
    const queryClient = useQueryClient();
    const cacheKey = entityTagQueryKeys.assignments(entityType, entityId);

    return useMutation({
        mutationFn: (tagId: string) => assignTagToEntity(entityType, entityId, tagId),
        onMutate: async (tagId) => {
            await queryClient.cancelQueries({ queryKey: cacheKey });
            const previous = queryClient.getQueryData<Tag[]>(cacheKey);

            // Optimistically add the tag to the assignment list (as placeholder).
            if (previous) {
                queryClient.setQueryData<Tag[]>(cacheKey, (old) =>
                    old ? [...old, { id: tagId } as Tag] : [{ id: tagId } as Tag]
                );
            }

            return { previous };
        },
        onError: (_err, _tagId, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(cacheKey, context.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: cacheKey });
        }
    });
}

/**
 * Mutation to remove a tag assignment from an entity.
 * Uses optimistic updates and invalidates assignment cache on success.
 *
 * @param entityType - Entity type (EntityTypeEnum)
 * @param entityId - Entity UUID
 */
export function useRemoveTag(entityType: EntityTypeEnum, entityId: string) {
    const queryClient = useQueryClient();
    const cacheKey = entityTagQueryKeys.assignments(entityType, entityId);

    return useMutation({
        mutationFn: (tagId: string) => removeTagFromEntity(entityType, entityId, tagId),
        onMutate: async (tagId) => {
            await queryClient.cancelQueries({ queryKey: cacheKey });
            const previous = queryClient.getQueryData<Tag[]>(cacheKey);

            // Optimistically remove the tag from the assignment list.
            if (previous) {
                queryClient.setQueryData<Tag[]>(
                    cacheKey,
                    previous.filter((t) => t.id !== tagId)
                );
            }

            return { previous };
        },
        onError: (_err, _tagId, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(cacheKey, context.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: cacheKey });
        }
    });
}

/**
 * usePointOfInterestCategories — TanStack Query hooks for the POI ↔
 * POI-category assignment (HOS-143's `/{id}/categories` admin routes).
 *
 * Exposes:
 *  - usePointOfInterestCategoriesQuery(pointOfInterestId)     → GET, list query
 *  - useSetPointOfInterestCategoriesMutation(pointOfInterestId) → PUT, full replace
 *
 * Unlike `usePointOfInterestDestinations.ts` (per-item granular CRUD, no
 * "Save" step), this pair backs a full-replace chip-selector form
 * (HOS-144 §6.4): there is exactly one mutating action — `PUT
 * /{id}/categories` with the complete `{ categoryIds, primaryCategoryId }`
 * set — so there is no per-row optimistic update/rollback here, only a
 * single query invalidation on success.
 *
 * The GET response (`PointOfInterestCategoryAssignment[]`) is symmetric with
 * the PUT response (HOS-144): every entry carries the per-POI `isPrimary`
 * flag, so `PoiCategoryManager` can pre-select the primary radio from the
 * initial fetch instead of requiring the operator to re-pick it every time
 * the tab is opened.
 */

import type { PointOfInterestCategoryAssignment } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/**
 * Query key factory for a point of interest's assigned-category list.
 * Centralises key generation so the save mutation's invalidation stays
 * consistent with the query.
 */
export const poiCategoryQueryKeys = {
    all: (pointOfInterestId: string) =>
        ['points-of-interest', pointOfInterestId, 'categories'] as const,
    list: (pointOfInterestId: string) =>
        [...poiCategoryQueryKeys.all(pointOfInterestId), 'list'] as const
};

const categoriesEndpoint = (pointOfInterestId: string) =>
    `/api/v1/admin/points-of-interest/${pointOfInterestId}/categories`;

/**
 * Fetches the POI categories currently assigned to a point of interest.
 *
 * @param pointOfInterestId - UUID of the point of interest
 */
export function usePointOfInterestCategoriesQuery(pointOfInterestId: string) {
    return useQuery({
        queryKey: poiCategoryQueryKeys.list(pointOfInterestId),
        queryFn: async () => {
            const response = await fetchApi<{
                success: boolean;
                data: PointOfInterestCategoryAssignment[];
            }>({ path: categoriesEndpoint(pointOfInterestId) });
            return response.data.data ?? [];
        },
        enabled: Boolean(pointOfInterestId),
        staleTime: 30_000
    });
}

/** Payload for {@link useSetPointOfInterestCategoriesMutation}. */
export interface SetPointOfInterestCategoriesInput {
    readonly categoryIds: string[];
    readonly primaryCategoryId: string;
}

/**
 * Mutation that full-replaces a point of interest's category set in one
 * transactional call (PUT), including which category is primary. On success,
 * invalidates the assigned-category list so a subsequent read reflects the
 * new set.
 *
 * @param pointOfInterestId - UUID of the point of interest
 */
export function useSetPointOfInterestCategoriesMutation(pointOfInterestId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: SetPointOfInterestCategoriesInput) => {
            const response = await fetchApi<{
                success: boolean;
                data: { categories: unknown[] };
            }>({
                path: categoriesEndpoint(pointOfInterestId),
                method: 'PUT',
                body: input
            });
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: poiCategoryQueryKeys.list(pointOfInterestId)
            });
        }
    });
}

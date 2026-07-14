/**
 * usePointOfInterestDestinations — TanStack Query hooks for the POI ↔
 * destination relation CRUD (HOS-143's `/{id}/destinations` admin routes).
 *
 * Exposes:
 *  - usePointOfInterestDestinationsQuery(pointOfInterestId)          → list query
 *  - useAddPointOfInterestDestinationMutation(pointOfInterestId)     → POST
 *  - useUpdatePointOfInterestDestinationRelationMutation(poiId)      → PATCH
 *  - useRemovePointOfInterestDestinationMutation(pointOfInterestId)  → DELETE
 *
 * Mirrors `features/faqs/hooks/useFaqs.ts`'s per-item granular CRUD shape
 * (HOS-144 §6.6): each action persists immediately, there is no bulk
 * form-array save.
 *
 * `useUpdatePointOfInterestDestinationRelationMutation` additionally applies
 * an optimistic update to the cached list on `onMutate`, rolls it back on
 * `onError`, and always refetches on `onSettled` so the UI reflects the real
 * persisted value after the round trip (HOS-144 R-4/AC-4).
 *
 * This hook is instantiated PER ROW (one instance per `PoiDestinationRow`,
 * not one shared instance for the whole list — HOS-144 judgment-day FIX 2),
 * so concurrent edits on different rows don't share `isPending`/`variables`
 * state. The optimistic snapshot/rollback is also scoped to a single list
 * ITEM rather than the whole list: `onMutate` snapshots only the target
 * item's previous value, and `onError` restores only that item within
 * whatever the current cache list looks like — never overwrites the full
 * list — so a failed PATCH on one row can never clobber another row's
 * concurrently-applied optimistic change. `onSettled`'s invalidate is what
 * ultimately reconciles the cache with the server's real state.
 */

import type {
    PointOfInterestDestinationListItem,
    PointOfInterestDestinationRelationEnum
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/**
 * Query key factory for a point of interest's destination-relations list.
 * Centralises key generation so invalidations/optimistic updates stay
 * consistent across the add/update/remove mutations.
 */
export const poiDestinationQueryKeys = {
    all: (pointOfInterestId: string) =>
        ['points-of-interest', pointOfInterestId, 'destinations'] as const,
    list: (pointOfInterestId: string) =>
        [...poiDestinationQueryKeys.all(pointOfInterestId), 'list'] as const
};

const destinationsEndpoint = (pointOfInterestId: string) =>
    `/api/v1/admin/points-of-interest/${pointOfInterestId}/destinations`;

/**
 * Fetches the current destination relations for a point of interest.
 *
 * @param pointOfInterestId - UUID of the point of interest
 */
export function usePointOfInterestDestinationsQuery(pointOfInterestId: string) {
    return useQuery({
        queryKey: poiDestinationQueryKeys.list(pointOfInterestId),
        queryFn: async () => {
            const response = await fetchApi<{
                success: boolean;
                data: PointOfInterestDestinationListItem[];
            }>({ path: destinationsEndpoint(pointOfInterestId) });
            return response.data.data ?? [];
        },
        enabled: Boolean(pointOfInterestId),
        staleTime: 30_000
    });
}

/** Payload for {@link useAddPointOfInterestDestinationMutation}. */
export interface AddPointOfInterestDestinationInput {
    readonly destinationId: string;
    readonly relation: PointOfInterestDestinationRelationEnum;
}

/**
 * Mutation to link a point of interest to a destination (POST). Defaults to
 * PRIMARY on the server when `relation` is omitted, but this hook always
 * sends it explicitly (the "Add destination" row's radio selection).
 *
 * @param pointOfInterestId - UUID of the point of interest
 */
export function useAddPointOfInterestDestinationMutation(pointOfInterestId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: AddPointOfInterestDestinationInput) => {
            const response = await fetchApi<{
                success: boolean;
                data: { relation: PointOfInterestDestinationRelationEnum };
            }>({
                path: destinationsEndpoint(pointOfInterestId),
                method: 'POST',
                body: input
            });
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: poiDestinationQueryKeys.list(pointOfInterestId)
            });
        }
    });
}

/** Payload for {@link useUpdatePointOfInterestDestinationRelationMutation}. */
export interface UpdatePointOfInterestDestinationRelationInput {
    readonly destinationId: string;
    readonly relation: PointOfInterestDestinationRelationEnum;
}

/**
 * Mutation context snapshot used to roll back a failed optimistic update.
 * Scoped to the single target ITEM (not the whole list) so concurrent
 * mutations on other rows are never clobbered by this row's rollback
 * (HOS-144 judgment-day FIX 2).
 */
interface UpdateRelationMutationContext {
    readonly previousItem: PointOfInterestDestinationListItem | undefined;
}

/**
 * Mutation to change the PRIMARY/NEARBY relation kind of an EXISTING
 * point-of-interest-destination link (PATCH). Never creates the link.
 *
 * Optimistic-update + rollback (HOS-144 §6.6/R-4): `onMutate` writes the new
 * relation straight into the cached list so the row's badge/`<select>`
 * update instantly; `onError` restores ONLY the target item (looked up
 * within whatever the current cache list is at error time, not a stale
 * full-list snapshot) so a concurrently-applied change on a different row
 * is preserved; `onSettled` always refetches so a page reload (or the
 * refetch itself) reflects the real persisted server value, not just the
 * optimistic guess (AC-4).
 *
 * Callers must instantiate this hook PER ROW, not once for a whole list —
 * see the module doc comment.
 *
 * @param pointOfInterestId - UUID of the point of interest
 */
export function useUpdatePointOfInterestDestinationRelationMutation(pointOfInterestId: string) {
    const queryClient = useQueryClient();
    const listKey = poiDestinationQueryKeys.list(pointOfInterestId);

    return useMutation<
        { relation: PointOfInterestDestinationRelationEnum },
        Error,
        UpdatePointOfInterestDestinationRelationInput,
        UpdateRelationMutationContext
    >({
        mutationFn: async ({ destinationId, relation }) => {
            const response = await fetchApi<{
                success: boolean;
                data: { relation: PointOfInterestDestinationRelationEnum };
            }>({
                path: `${destinationsEndpoint(pointOfInterestId)}/${destinationId}`,
                method: 'PATCH',
                body: { relation }
            });
            return response.data.data;
        },
        onMutate: async ({ destinationId, relation }) => {
            await queryClient.cancelQueries({ queryKey: listKey });
            const currentList =
                queryClient.getQueryData<PointOfInterestDestinationListItem[]>(listKey);
            const previousItem = currentList?.find((item) => item.destinationId === destinationId);

            if (currentList) {
                queryClient.setQueryData<PointOfInterestDestinationListItem[]>(
                    listKey,
                    currentList.map((item) =>
                        item.destinationId === destinationId ? { ...item, relation } : item
                    )
                );
            }

            return { previousItem };
        },
        onError: (_error, { destinationId }, context) => {
            const previousItem = context?.previousItem;
            if (!previousItem) return;

            queryClient.setQueryData<PointOfInterestDestinationListItem[]>(listKey, (current) =>
                current?.map((item) => (item.destinationId === destinationId ? previousItem : item))
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: listKey });
        }
    });
}

/**
 * Mutation to remove a point-of-interest-destination link (DELETE).
 *
 * `mutationFn` accepts the bare `destinationId` string (not an object) so
 * this hook's shape matches the `DeleteMutationLike` contract other row-level
 * delete affordances in the codebase expect.
 *
 * @param pointOfInterestId - UUID of the point of interest
 */
export function useRemovePointOfInterestDestinationMutation(pointOfInterestId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (destinationId: string) => {
            await fetchApi({
                path: `${destinationsEndpoint(pointOfInterestId)}/${destinationId}`,
                method: 'DELETE'
            });
            return destinationId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: poiDestinationQueryKeys.list(pointOfInterestId)
            });
        }
    });
}

/**
 * @file createCommerceEntityHooks.ts
 * Factory that extends the generic `createEntityHooks` CRUD suite with
 * commerce-domain mutations:
 *
 *   - `useAssignOwnerMutation`    — POST  `${endpoint}/${id}/assign-owner`
 *   - `useModerateReviewMutation` — POST  `${endpoint}/reviews/${reviewId}/moderate`
 *   - `usePendingReviewsQuery`    — GET   `${endpoint}/reviews?status=PENDING&…`
 *
 * The factory delegates standard CRUD (list, detail, create, update, patch,
 * delete, softDelete, restore) to `createEntityHooks` and adds only the
 * commerce-specific hooks on top.
 *
 * Response unwrapping follows the verified gastronomy/accommodation API shape:
 *   GET detail   →  `{ success, data: <entity> }`          → unwrap `response.data.data`
 *   GET list     →  `{ success, data: { items, pagination } }` → handled by createEntityHooks
 *   POST mutate  →  `{ success, data: <entity | null> }`   → unwrap `response.data.data`
 *
 * @module createCommerceEntityHooks
 */

import { fetchApi } from '@/lib/api/client';
import { createEntityHooks } from '@/lib/factories/createEntityHooks';
import { createEntityQueryKeys } from '@/lib/query-keys/factory';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Parameters required to instantiate the commerce entity hooks factory.
 *
 * @typeParam TData - Entity shape; must have an `id: string` field.
 */
export type CommerceEntityHooksConfig = {
    /**
     * Entity name used as the TanStack Query root cache key (e.g. `'gastronomy'`).
     * Must match the `entityName` passed to `createCommerceListConfig`.
     */
    readonly entityName: string;

    /**
     * Base admin API endpoint (e.g. `'/api/v1/admin/gastronomy'`).
     */
    readonly apiEndpoint: string;
};

// ---------------------------------------------------------------------------
// Mutation/query input shapes
// ---------------------------------------------------------------------------

/** Input for the assign-owner mutation. */
export type AssignOwnerInput = {
    /** ID of the commerce entity to update. */
    readonly id: string;
    /** ID of the user who will become the new owner. */
    readonly ownerId: string;
};

/** Decision values for review moderation. */
export type ReviewModerationDecision = 'APPROVED' | 'REJECTED';

/** Input for the moderate-review mutation. */
export type ModerateReviewInput = {
    /** ID of the review to moderate. */
    readonly reviewId: string;
    /** Moderation decision. */
    readonly decision: ReviewModerationDecision;
    /** Optional reason (required when decision is `'REJECTED'`). */
    readonly reason?: string;
};

/** Query params for pending reviews. */
export type PendingReviewsQueryParams = {
    /** Page number (1-based). */
    readonly page?: number;
    /** Items per page. */
    readonly pageSize?: number;
    /** Additional arbitrary filters forwarded to the API. */
    readonly filters?: Readonly<Record<string, string | number | boolean>>;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a full set of CRUD + commerce-specific hooks for a commerce entity.
 *
 * The returned object contains all hooks from `createEntityHooks` plus:
 *   - `useAssignOwnerMutation` — reassign the entity owner.
 *   - `useModerateReviewMutation` — approve or reject a review.
 *   - `usePendingReviewsQuery` — query reviews awaiting moderation.
 *
 * @typeParam TData - Entity shape (must extend `{ id: string }`).
 * @param config - Entity name and API endpoint.
 * @returns Object containing all entity hooks.
 *
 * @example
 * ```ts
 * // In the gastronomy feature (SPEC-240):
 * const gastronomyHooks = createCommerceEntityHooks<GastronomyEntity>({
 *   entityName: 'gastronomy',
 *   apiEndpoint: '/api/v1/admin/gastronomy',
 * });
 *
 * // In a component:
 * const assignOwner = gastronomyHooks.useAssignOwnerMutation();
 * const moderateReview = gastronomyHooks.useModerateReviewMutation();
 * const { data: pendingReviews } = gastronomyHooks.usePendingReviewsQuery({ page: 1 });
 * ```
 */
export function createCommerceEntityHooks<TData extends { id: string }>(
    config: CommerceEntityHooksConfig
) {
    const { entityName, apiEndpoint } = config;

    // ------------------------------------------------------------------
    // Standard CRUD hooks (list, detail, create, update, patch, delete, …)
    // ------------------------------------------------------------------
    const crudHooks = createEntityHooks<TData>({ entityName, apiEndpoint });
    const queryKeys = createEntityQueryKeys(entityName);

    // ------------------------------------------------------------------
    // Commerce-specific: assign owner
    // ------------------------------------------------------------------

    /**
     * Mutation hook that reassigns the owner of a commerce entity.
     *
     * Calls `POST ${apiEndpoint}/${id}/assign-owner` with `{ ownerId }`.
     * Invalidates the entity detail and list caches on success.
     *
     * @returns A TanStack Query `UseMutationResult`.
     */
    function useAssignOwnerMutation() {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: async ({ id, ownerId }: AssignOwnerInput) => {
                const response = await fetchApi<{ data: TData }>({
                    path: `${apiEndpoint}/${id}/assign-owner`,
                    method: 'POST',
                    body: { ownerId }
                });

                // Response shape: { success, data: <entity> }
                return (response.data as { data?: TData }).data as TData;
            },
            onSuccess: (_data, variables) => {
                queryClient.invalidateQueries({ queryKey: queryKeys.detail(variables.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
            }
        });
    }

    // ------------------------------------------------------------------
    // Commerce-specific: review moderation
    // ------------------------------------------------------------------

    /**
     * Mutation hook that approves or rejects a review for a commerce entity.
     *
     * Calls `POST ${apiEndpoint}/reviews/${reviewId}/moderate`
     * with `{ decision, reason? }`.
     * Invalidates all review-related queries for this entity on success.
     *
     * @returns A TanStack Query `UseMutationResult`.
     */
    function useModerateReviewMutation() {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: async ({ reviewId, decision, reason }: ModerateReviewInput) => {
                const body: Record<string, unknown> = { decision };
                if (reason !== undefined) {
                    body.reason = reason;
                }

                const response = await fetchApi<{ data: unknown }>({
                    path: `${apiEndpoint}/reviews/${reviewId}/moderate`,
                    method: 'POST',
                    body
                });

                return (response.data as { data?: unknown }).data;
            },
            onSuccess: () => {
                // Invalidate all queries that involve reviews for this entity
                queryClient.invalidateQueries({
                    queryKey: [...queryKeys.all, 'reviews']
                });
            }
        });
    }

    /**
     * Query hook that fetches reviews pending moderation for a commerce entity.
     *
     * Calls `GET ${apiEndpoint}/reviews?status=PENDING&page=…&pageSize=…`.
     * Response unwrapped as `response.data.data`.
     *
     * @param params - Optional pagination and filter params.
     * @returns A TanStack Query `UseQueryResult`.
     */
    function usePendingReviewsQuery(params: PendingReviewsQueryParams = {}) {
        const { page = 1, pageSize = 20, filters = {} } = params;

        return useQuery({
            queryKey: [...queryKeys.all, 'reviews', 'pending', { page, pageSize, filters }],
            queryFn: async () => {
                const searchParams = new URLSearchParams();
                searchParams.set('status', 'PENDING');
                searchParams.set('page', String(page));
                searchParams.set('pageSize', String(pageSize));

                for (const [key, value] of Object.entries(filters)) {
                    searchParams.set(key, String(value));
                }

                const response = await fetchApi<unknown>({
                    path: `${apiEndpoint}/reviews?${searchParams.toString()}`
                });

                // Response shape: { success, data: { items, pagination } }
                const body = response.data as {
                    data?: {
                        items?: unknown[];
                        pagination?: { page: number; pageSize: number; total: number };
                    };
                };

                return {
                    items: body.data?.items ?? [],
                    pagination: body.data?.pagination ?? { page, pageSize, total: 0 }
                };
            },
            staleTime: 2 * 60 * 1000 // 2 minutes — reviews stale faster than entity data
        });
    }

    // ------------------------------------------------------------------
    // Composite return
    // ------------------------------------------------------------------
    return {
        // Standard CRUD (forwarded from createEntityHooks)
        ...crudHooks,

        // Commerce-specific hooks
        useAssignOwnerMutation,
        useModerateReviewMutation,
        usePendingReviewsQuery,

        // Expose query keys for external invalidation
        queryKeys
    };
}

/**
 * Type helper to extract the full hook set produced by `createCommerceEntityHooks`.
 *
 * @typeParam TData - Entity shape used when calling the factory.
 */
export type CommerceEntityHooks<TData extends { id: string }> = ReturnType<
    typeof createCommerceEntityHooks<TData>
>;

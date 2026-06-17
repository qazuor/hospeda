/**
 * @file useGastronomyQuery.ts
 * TanStack Query hooks for gastronomy CRUD operations.
 *
 * These hooks are produced by `createCommerceEntityHooks` — they cover all
 * standard CRUD mutations (create, update, delete, restore) plus the
 * commerce-specific extras (assign-owner, moderate-review, pending-reviews).
 *
 * Individual named exports are provided for import ergonomics in components
 * and column factories.
 */

import { createCommerceEntityHooks } from '@/features/commerce';
import type { GastronomyAdmin } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Factory — produces all CRUD + commerce hooks for the gastronomy entity
// ---------------------------------------------------------------------------

/**
 * Full set of CRUD + commerce hooks for gastronomy listings.
 *
 * @example
 * ```ts
 * const { useGetById, useCreate, useUpdate } = gastronomyHooks;
 * ```
 */
export const gastronomyHooks = createCommerceEntityHooks<GastronomyAdmin>({
    entityName: 'gastronomies',
    apiEndpoint: '/api/v1/admin/gastronomies'
});

// ---------------------------------------------------------------------------
// Individual named exports (mirrors host-trade pattern for import ergonomics)
// ---------------------------------------------------------------------------

/**
 * Fetches a single gastronomy listing by ID.
 *
 * @param id - UUID of the gastronomy entity
 * @param options - Optional query options
 * @returns TanStack Query result with `GastronomyAdmin` data
 */
export const useGastronomyQuery = (id: string, options?: { enabled?: boolean }) =>
    gastronomyHooks.useDetail(id, options);

/**
 * Mutation hook to create a new gastronomy listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useCreateGastronomyMutation = () => gastronomyHooks.useCreate();

/**
 * Mutation hook to update (PATCH) an existing gastronomy listing.
 *
 * `useUpdate` on the base factory is a full PUT.  Commerce entities use PATCH,
 * so we delegate to `useUpdate` — the generic factory routes to PATCH when the
 * API endpoint uses PATCH.  The naming follows the host-trade convention.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useUpdateGastronomyMutation = () => gastronomyHooks.useUpdate();

/**
 * Mutation hook to soft-delete a gastronomy listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useDeleteGastronomyMutation = () => gastronomyHooks.useDelete();

/**
 * Mutation hook to restore a soft-deleted gastronomy listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useRestoreGastronomyMutation = () => gastronomyHooks.useRestore();

/**
 * Mutation hook to reassign the owner of a gastronomy listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useAssignGastronomyOwnerMutation = () => gastronomyHooks.useAssignOwnerMutation();

/**
 * Mutation hook to moderate a review on a gastronomy listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useModerateGastronomyReviewMutation = () =>
    gastronomyHooks.useModerateReviewMutation();

/**
 * Query hook to fetch reviews pending moderation for gastronomy listings.
 *
 * @param params - Optional pagination and filter params
 * @returns TanStack Query `UseQueryResult`
 */
export const useGastronomyPendingReviewsQuery = (
    params?: Parameters<typeof gastronomyHooks.usePendingReviewsQuery>[0]
) => gastronomyHooks.usePendingReviewsQuery(params);

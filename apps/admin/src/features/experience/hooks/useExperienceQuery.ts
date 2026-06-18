/**
 * @file useExperienceQuery.ts
 * TanStack Query hooks for experience CRUD operations (SPEC-240 T-028).
 *
 * These hooks are produced by `createCommerceEntityHooks` — they cover all
 * standard CRUD mutations (create, update, delete, restore) plus the
 * commerce-specific extras (assign-owner, moderate-review, pending-reviews).
 *
 * Individual named exports are provided for import ergonomics in components
 * and column factories.
 */

import { createCommerceEntityHooks } from '@/features/commerce';
import type { ExperienceAdmin } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Factory — produces all CRUD + commerce hooks for the experience entity
// ---------------------------------------------------------------------------

/**
 * Full set of CRUD + commerce hooks for experience listings.
 *
 * @example
 * ```ts
 * const { useGetById, useCreate, useUpdate } = experienceHooks;
 * ```
 */
export const experienceHooks = createCommerceEntityHooks<ExperienceAdmin>({
    entityName: 'experiences',
    apiEndpoint: '/api/v1/admin/experiences'
});

// ---------------------------------------------------------------------------
// Individual named exports (mirrors gastronomy pattern for import ergonomics)
// ---------------------------------------------------------------------------

/**
 * Fetches a single experience listing by ID.
 *
 * @param id - UUID of the experience entity
 * @param options - Optional query options
 * @returns TanStack Query result with `ExperienceAdmin` data
 */
export const useExperienceQuery = (id: string, options?: { enabled?: boolean }) =>
    experienceHooks.useDetail(id, options);

/**
 * Mutation hook to create a new experience listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useCreateExperienceMutation = () => experienceHooks.useCreate();

/**
 * Mutation hook to update (PATCH) an existing experience listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useUpdateExperienceMutation = () => experienceHooks.useUpdate();

/**
 * Mutation hook to soft-delete an experience listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useDeleteExperienceMutation = () => experienceHooks.useDelete();

/**
 * Mutation hook to restore a soft-deleted experience listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useRestoreExperienceMutation = () => experienceHooks.useRestore();

/**
 * Mutation hook to reassign the owner of an experience listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useAssignExperienceOwnerMutation = () => experienceHooks.useAssignOwnerMutation();

/**
 * Mutation hook to moderate a review on an experience listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useModerateExperienceReviewMutation = () =>
    experienceHooks.useModerateReviewMutation();

/**
 * Query hook to fetch reviews pending moderation for experience listings.
 *
 * @param params - Optional pagination and filter params
 * @returns TanStack Query `UseQueryResult`
 */
export const useExperiencePendingReviewsQuery = (
    params?: Parameters<typeof experienceHooks.usePendingReviewsQuery>[0]
) => experienceHooks.usePendingReviewsQuery(params);

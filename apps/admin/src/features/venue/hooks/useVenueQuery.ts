/**
 * @file useVenueQuery.ts
 * TanStack Query hooks for gastronomy CRUD operations.
 *
 * These hooks are produced by `createListingEntityHooks` — they cover all
 * standard CRUD mutations (create, update, delete, restore) plus the
 * listing-specific extras (assign-owner, moderate-review, pending-reviews).
 *
 * Individual named exports are provided for import ergonomics in components
 * and column factories.
 */

import type { VenueAdmin } from '@repo/schemas';
import { createListingEntityHooks } from '@/features/listing';

// ---------------------------------------------------------------------------
// Factory — produces all CRUD + listing hooks for the gastronomy entity
// ---------------------------------------------------------------------------

/**
 * Full set of CRUD + listing hooks for gastronomy listings.
 *
 * @example
 * ```ts
 * const { useGetById, useCreate, useUpdate } = venueHooks;
 * ```
 */
export const venueHooks = createListingEntityHooks<VenueAdmin>({
    entityName: 'gastronomies',
    apiEndpoint: '/api/v1/admin/venues'
});

// ---------------------------------------------------------------------------
// Individual named exports (mirrors host-trade pattern for import ergonomics)
// ---------------------------------------------------------------------------

/**
 * Fetches a single gastronomy listing by ID.
 *
 * @param id - UUID of the gastronomy entity
 * @param options - Optional query options
 * @returns TanStack Query result with `VenueAdmin` data
 */
export const useVenueQuery = (id: string, options?: { enabled?: boolean }) =>
    venueHooks.useDetail(id, options);

/**
 * Mutation hook to create a new gastronomy listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useCreateVenueMutation = () => venueHooks.useCreate();

/**
 * Mutation hook to update (PATCH) an existing gastronomy listing.
 *
 * `useUpdate` on the base factory is a full PUT.  Listing entities use PATCH,
 * so we delegate to `useUpdate` — the generic factory routes to PATCH when the
 * API endpoint uses PATCH.  The naming follows the host-trade convention.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useUpdateVenueMutation = () => venueHooks.useUpdate();

/**
 * Mutation hook to reassign the owner of a gastronomy listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useAssignVenueOwnerMutation = () => venueHooks.useAssignOwnerMutation();

/**
 * Mutation hook to moderate a review on a gastronomy listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useModerateVenueReviewMutation = () => venueHooks.useModerateReviewMutation();

/**
 * Query hook to fetch reviews pending moderation for gastronomy listings.
 *
 * @param params - Optional pagination and filter params
 * @returns TanStack Query `UseQueryResult`
 */
export const useVenuePendingReviewsQuery = (
    params?: Parameters<typeof venueHooks.usePendingReviewsQuery>[0]
) => venueHooks.usePendingReviewsQuery(params);

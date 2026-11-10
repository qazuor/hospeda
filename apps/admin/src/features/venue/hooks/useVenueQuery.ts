/**
 * @file useVenueQuery.ts
 * TanStack Query hooks for venue CRUD operations.
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
// Factory — produces all CRUD + listing hooks for the venue entity
// ---------------------------------------------------------------------------

/**
 * Full set of CRUD + listing hooks for venue listings.
 *
 * @example
 * ```ts
 * const { useGetById, useCreate, useUpdate } = venueHooks;
 * ```
 */
export const venueHooks = createListingEntityHooks<VenueAdmin>({
    entityName: 'venues',
    apiEndpoint: '/api/v1/admin/venues'
});

// ---------------------------------------------------------------------------
// Individual named exports (mirrors host-trade pattern for import ergonomics)
// ---------------------------------------------------------------------------

/**
 * Fetches a single venue listing by ID.
 *
 * @param id - UUID of the venue entity
 * @param options - Optional query options
 * @returns TanStack Query result with `VenueAdmin` data
 */
export const useVenueQuery = (id: string, options?: { enabled?: boolean }) =>
    venueHooks.useDetail(id, options);

/**
 * Mutation hook to create a new venue listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useCreateVenueMutation = () => venueHooks.useCreate();

/**
 * Mutation hook to update (PATCH) an existing venue listing.
 *
 * `useUpdate` on the base factory is a full PUT.  Listing entities use PATCH,
 * so we delegate to `useUpdate` — the generic factory routes to PATCH when the
 * API endpoint uses PATCH.  The naming follows the host-trade convention.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useUpdateVenueMutation = () => venueHooks.useUpdate();

/**
 * Mutation hook to reassign the owner of a venue listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useAssignVenueOwnerMutation = () => venueHooks.useAssignOwnerMutation();

/**
 * Mutation hook to moderate a review on a venue listing.
 *
 * @returns TanStack Query `UseMutationResult`
 */
export const useModerateVenueReviewMutation = () => venueHooks.useModerateReviewMutation();

/**
 * Query hook to fetch reviews pending moderation for one venue listing.
 *
 * `venueId` is required (HOS-2051): the per-listing moderation panel passes
 * its own listing's id, so the list is scoped to that listing server-side
 * (`GET /api/v1/admin/venues/reviews?status=PENDING&venueId=…`). Making it a
 * compile-time requirement stops a panel from silently listing every venue's
 * pending reviews again.
 *
 * @param params - `venueId` (required) plus optional pagination
 * @returns TanStack Query `UseQueryResult`
 */
export const useVenuePendingReviewsQuery = ({
    venueId,
    page,
    pageSize
}: {
    readonly venueId: string;
    readonly page?: number;
    readonly pageSize?: number;
}) => venueHooks.usePendingReviewsQuery({ page, pageSize, filters: { venueId } });

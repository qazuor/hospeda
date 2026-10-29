/**
 * @file useVenues.ts
 * TanStack Query hooks for venue CRUD operations — thin wrappers that
 * re-export the factory-generated hooks from `useVenueQuery.ts` under the
 * canonical names expected by the task manifest.
 *
 * IMPORTANT: Do NOT duplicate business logic here.  All real implementation
 * lives in `createListingEntityHooks` → `venueHooks` in
 * `useVenueQuery.ts`.  This file simply re-exports so that callers that
 * import from `useVenues` get a stable public surface.
 */

export { useVenuePage } from './useVenuePage';
export {
    useAssignVenueOwnerMutation,
    useCreateVenueMutation,
    useModerateVenueReviewMutation,
    useUpdateVenueMutation,
    useVenuePendingReviewsQuery,
    useVenueQuery,
    venueHooks
} from './useVenueQuery';

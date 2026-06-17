/**
 * @file useGastronomies.ts
 * TanStack Query hooks for gastronomy CRUD operations — thin wrappers that
 * re-export the factory-generated hooks from `useGastronomyQuery.ts` under the
 * canonical names expected by the task manifest.
 *
 * IMPORTANT: Do NOT duplicate business logic here.  All real implementation
 * lives in `createCommerceEntityHooks` → `gastronomyHooks` in
 * `useGastronomyQuery.ts`.  This file simply re-exports so that callers that
 * import from `useGastronomies` get a stable public surface.
 */

export {
    gastronomyHooks,
    useAssignGastronomyOwnerMutation,
    useCreateGastronomyMutation,
    useDeleteGastronomyMutation,
    useGastronomyPendingReviewsQuery,
    useGastronomyQuery,
    useModerateGastronomyReviewMutation,
    useRestoreGastronomyMutation,
    useUpdateGastronomyMutation
} from './useGastronomyQuery';

export { useGastronomyPage } from './useGastronomyPage';

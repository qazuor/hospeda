/**
 * @file useExperiences.ts
 * TanStack Query hooks for experience CRUD operations — thin wrappers that
 * re-export the factory-generated hooks from `useExperienceQuery.ts` under the
 * canonical names expected by the task manifest (SPEC-240 T-028).
 *
 * IMPORTANT: Do NOT duplicate business logic here.  All real implementation
 * lives in `createCommerceEntityHooks` → `experienceHooks` in
 * `useExperienceQuery.ts`.  This file simply re-exports so that callers that
 * import from `useExperiences` get a stable public surface.
 */

export {
    experienceHooks,
    useAssignExperienceOwnerMutation,
    useCreateExperienceMutation,
    useDeleteExperienceMutation,
    useExperiencePendingReviewsQuery,
    useExperienceQuery,
    useModerateExperienceReviewMutation,
    useRestoreExperienceMutation,
    useUpdateExperienceMutation
} from './useExperienceQuery';

export { useExperiencePage } from './useExperiencePage';

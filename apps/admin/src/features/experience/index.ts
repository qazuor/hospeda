/**
 * @file index.ts
 * Public barrel for the experience admin feature (SPEC-240 T-028).
 *
 * Exports the list config + route/component pair, the consolidated form
 * configuration factory, all query hooks, and the page-orchestrator hook.
 *
 * DO NOT export internal file paths from this barrel — consumers must import
 * from `@/features/experience`, not from sub-paths.
 */

// Column factory
export { createExperienceColumns } from './config/experience.columns';

export type { ExperienceListItem } from './config/experience.config';
// List config + entity-list page (route + component)
export {
    EXPERIENCE_VIEW_PERMISSION,
    ExperiencesPageComponent,
    ExperiencesRoute,
    experienceListConfig
} from './config/experience.config';

// Consolidated form config
export { createExperienceConsolidatedConfig } from './config/experience-consolidated.config';
export { useExperiencePage } from './hooks/useExperiencePage';
// Hooks
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
} from './hooks/useExperienceQuery';

// Canonical hooks re-export (mirrors gastronomy pattern)
export {
    useCreateExperienceMutation as useExperienceCreate,
    useDeleteExperienceMutation as useExperienceDelete,
    useRestoreExperienceMutation as useExperienceRestore,
    useUpdateExperienceMutation as useExperienceUpdate
} from './hooks/useExperiences';

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

// List config + entity-list page (route + component)
export {
    EXPERIENCE_VIEW_PERMISSION,
    ExperiencesPageComponent,
    ExperiencesRoute,
    experienceListConfig
} from './config/experience.config';

export type { ExperienceListItem } from './config/experience.config';

// Column factory
export { createExperienceColumns } from './config/experience.columns';

// Consolidated form config
export { createExperienceConsolidatedConfig } from './config/experience-consolidated.config';

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

export { useExperiencePage } from './hooks/useExperiencePage';

// Canonical hooks re-export (mirrors gastronomy pattern)
export {
    useCreateExperienceMutation as useExperienceCreate,
    useUpdateExperienceMutation as useExperienceUpdate,
    useDeleteExperienceMutation as useExperienceDelete,
    useRestoreExperienceMutation as useExperienceRestore
} from './hooks/useExperiences';

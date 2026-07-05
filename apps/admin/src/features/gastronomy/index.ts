/**
 * @file index.ts
 * Public barrel for the gastronomy admin feature.
 *
 * Exports the list config + route/component pair, the consolidated form
 * configuration factory, all query hooks, and UI components for the
 * gastronomy entity.
 *
 * DO NOT export internal file paths from this barrel — consumers must import
 * from `@/features/gastronomy`, not from sub-paths.
 */

export type { GastronomyCardProps } from './components/GastronomyCard';
// UI components
export { GastronomyCard } from './components/GastronomyCard';
export type { GastronomyFormProps } from './components/GastronomyForm';
export { GastronomyForm } from './components/GastronomyForm';
export type { GastronomyQualityScoreProps } from './components/GastronomyQualityScore';
export { GastronomyQualityScore } from './components/GastronomyQualityScore';
// Column factory
export { createGastronomyColumns } from './config/gastronomy.columns';
export type { GastronomyListItem } from './config/gastronomy.config';
// List config + entity-list page (route + component)
export {
    GASTRONOMY_VIEW_PERMISSION,
    GastronomiesPageComponent,
    GastronomiesRoute,
    gastronomyListConfig
} from './config/gastronomy.config';
// Consolidated form config
export { createGastronomyConsolidatedConfig } from './config/gastronomy-consolidated.config';
// Quality score signals
export { createGastronomySignals } from './config/score-signals';
// Canonical hooks re-export (T-059 manifest)
export {
    useCreateGastronomyMutation as useGastronomyCreate,
    useDeleteGastronomyMutation as useGastronomyDelete,
    useRestoreGastronomyMutation as useGastronomyRestore,
    useUpdateGastronomyMutation as useGastronomyUpdate
} from './hooks/useGastronomies';
export { useGastronomyPage } from './hooks/useGastronomyPage';
// Hooks
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
} from './hooks/useGastronomyQuery';

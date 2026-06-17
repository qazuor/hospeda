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

// List config + entity-list page (route + component)
export {
    GastronomiesPageComponent,
    GastronomiesRoute,
    GASTRONOMY_VIEW_PERMISSION,
    gastronomyListConfig
} from './config/gastronomy.config';

export type { GastronomyListItem } from './config/gastronomy.config';

// Column factory
export { createGastronomyColumns } from './config/gastronomy.columns';

// Consolidated form config
export { createGastronomyConsolidatedConfig } from './config/gastronomy-consolidated.config';

// Quality score signals
export { createGastronomySignals } from './config/score-signals';

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

export { useGastronomyPage } from './hooks/useGastronomyPage';

// Canonical hooks re-export (T-059 manifest)
export {
    useCreateGastronomyMutation as useGastronomyCreate,
    useUpdateGastronomyMutation as useGastronomyUpdate,
    useDeleteGastronomyMutation as useGastronomyDelete,
    useRestoreGastronomyMutation as useGastronomyRestore
} from './hooks/useGastronomies';

// UI components
export { GastronomyCard } from './components/GastronomyCard';
export type { GastronomyCardProps } from './components/GastronomyCard';

export { GastronomyForm } from './components/GastronomyForm';
export type { GastronomyFormProps } from './components/GastronomyForm';

export { GastronomyQualityScore } from './components/GastronomyQualityScore';
export type { GastronomyQualityScoreProps } from './components/GastronomyQualityScore';

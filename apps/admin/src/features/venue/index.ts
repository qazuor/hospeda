/**
 * @file index.ts
 * Public barrel for the venue admin feature.
 *
 * Exports the list config + route/component pair, the consolidated form
 * configuration factory, all query hooks, and UI components for the
 * venue entity.
 *
 * DO NOT export internal file paths from this barrel — consumers must import
 * from `@/features/venue`, not from sub-paths.
 */

export type { VenueCardProps } from './components/VenueCard';
// UI components
export { VenueCard } from './components/VenueCard';
export type { VenueFormProps } from './components/VenueForm';
export { VenueForm } from './components/VenueForm';
export type { VenueQualityScoreProps } from './components/VenueQualityScore';
export { VenueQualityScore } from './components/VenueQualityScore';
// Quality score signals
export { createVenueSignals } from './config/score-signals';
// Column factory
export { createVenueColumns } from './config/venue.columns';
export type { VenueListItem } from './config/venue.config';
// List config + entity-list page (route + component)
export {
    VENUE_VIEW_PERMISSION,
    VenuesPageComponent,
    VenuesRoute,
    venueListConfig
} from './config/venue.config';
// Consolidated form config
export { createVenueConsolidatedConfig } from './config/venue-consolidated.config';
export { useVenuePage } from './hooks/useVenuePage';
// Hooks
export {
    useAssignVenueOwnerMutation,
    useCreateVenueMutation,
    useModerateVenueReviewMutation,
    useUpdateVenueMutation,
    useVenuePendingReviewsQuery,
    useVenueQuery,
    venueHooks
} from './hooks/useVenueQuery';
// Canonical hooks re-export (T-059 manifest)
export {
    useCreateVenueMutation as useVenueCreate,
    useUpdateVenueMutation as useVenueUpdate
} from './hooks/useVenues';

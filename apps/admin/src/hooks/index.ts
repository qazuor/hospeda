/**
 * Barrel export for custom hooks
 */

// Re-export types
export type {
    EntityPageConfig,
    EntityPermissions,
    EntityQueryHook,
    UseEntityPageConfig
} from './useEntityPage';
// Entity hooks
export { useEntityPage } from './useEntityPage';
export type { IntelligentNavigationConfig } from './useIntelligentNavigation';
// Navigation hooks
export { useIntelligentNavigation } from './useIntelligentNavigation';
export type { UseIntersectionObserverOptions } from './useIntersectionObserver';
// Performance hooks
export { useIntersectionObserver } from './useIntersectionObserver';
export type { LazySectionConfig } from './useLazySections';
export { useLazySections } from './useLazySections';
// Revalidation hooks
export {
    REVALIDATION_QUERY_KEYS,
    useManualRevalidate,
    useRevalidateEntity,
    useRevalidationConfigs,
    useRevalidationLogs,
    useRevalidationStats,
    useUpdateRevalidationConfig
} from './useRevalidation';
export type { OverallProgress, SectionProgress, SectionStatus } from './useSectionProgress';
export { useSectionProgress } from './useSectionProgress';
export type { SmartScrollOptions } from './useSmartScroll';
export { useSmartScroll } from './useSmartScroll';

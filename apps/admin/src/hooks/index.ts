/**
 * Barrel export for custom hooks
 */

// Performance hooks
export { useIntersectionObserver } from './useIntersectionObserver';
export { useLazySections } from './useLazySections';

// Navigation hooks
export { useIntelligentNavigation } from './useIntelligentNavigation';
export { useSectionProgress } from './useSectionProgress';
export { useSmartScroll } from './useSmartScroll';

// Entity hooks
export { useEntityPage } from './useEntityPage';

// Re-export types
export type {
    EntityPageConfig,
    EntityPermissions,
    EntityQueryHook,
    UseEntityPageConfig
} from './useEntityPage';
export type { IntelligentNavigationConfig } from './useIntelligentNavigation';
export type { UseIntersectionObserverOptions } from './useIntersectionObserver';
export type { LazySectionConfig } from './useLazySections';
export type { OverallProgress, SectionProgress, SectionStatus } from './useSectionProgress';
export type { SmartScrollOptions } from './useSmartScroll';

/**
 * Barrel export for custom hooks
 */

// Performance hooks
export { useIntersectionObserver } from './useIntersectionObserver';
export { useLazySections } from './useLazySections';

// Entity hooks
export { useEntityPage } from './useEntityPage';

// Re-export types
export type {
    EntityPageConfig,
    EntityPermissions,
    EntityQueryHook,
    UseEntityPageConfig
} from './useEntityPage';
export type { UseIntersectionObserverOptions } from './useIntersectionObserver';
export type { LazySectionConfig } from './useLazySections';

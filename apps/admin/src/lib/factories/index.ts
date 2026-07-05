/**
 * Factory functions for creating reusable entity components, hooks, and utilities
 *
 * These factories follow the pattern used throughout the admin app to reduce
 * boilerplate and ensure consistency across entity management.
 */

export { createEntityApi } from '@/components/entity-list/api/createEntityApi';
export { createEntityListPage } from '@/components/entity-list/EntityListPage';
// Re-export existing factories from other locations for convenience
export { createEntityQueryKeys } from '@/lib/query-keys/factory';
// Base Columns Factory
export {
    type BaseColumnsConfig,
    createAllBaseColumns,
    createAuditColumns,
    createEntityRefColumn,
    createFeaturedColumn,
    createLifecycleColumn,
    createModerationColumn,
    createNameColumn,
    createTimestampColumns,
    createVisibilityColumn,
    mergeWithBaseColumns,
    STATUS_BADGE_OPTIONS
} from './createBaseColumns';

// Entity Columns Factory (complete version with actions)
export {
    ACCOMMODATION_TYPE_OPTIONS,
    type ActionColumnResult,
    type ActionConfig,
    ActionType,
    type ActionType as ActionTypeEnum,
    BADGE_OPTIONS,
    type CreateEntityColumnsConfig,
    createActionColumn,
    createBadgeColumn,
    createBooleanColumn,
    createEntityColumn,
    createEntityColumns,
    createNumberColumn,
    type EntityColumnsResult,
    EVENT_TYPE_OPTIONS,
    type ExtendedColumnConfig,
    type NameColumnConfig,
    type PreparedAction
} from './createEntityColumns';
// Entity Hooks Factory
export {
    createEntityHooks,
    type EntityHooks,
    type EntityHooksConfig
} from './createEntityHooks';
// Entity Layout Factory
export {
    COMMON_TAB_PRESETS,
    createEntityLayout,
    createEntityLayoutWithPreset,
    type EntityLayoutConfig,
    type EntityLayoutResult,
    type EntityTabConfig,
    type TabPresetKey
} from './createEntityLayout.tsx';
// Entity Routes Factory
export {
    type CreateEntityPageHook,
    createEntityLoader,
    createErrorComponent,
    createPendingComponent,
    createRouteComponents,
    type EntityPageHookConfig,
    RouteComponents
} from './createEntityRoutes.tsx';

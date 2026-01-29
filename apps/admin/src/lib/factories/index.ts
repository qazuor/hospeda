/**
 * Factory functions for creating reusable entity components, hooks, and utilities
 *
 * These factories follow the pattern used throughout the admin app to reduce
 * boilerplate and ensure consistency across entity management.
 */

// Entity Hooks Factory
export {
    createEntityHooks,
    type EntityHooksConfig,
    type EntityHooks
} from './createEntityHooks';

// Base Columns Factory
export {
    createAllBaseColumns,
    createTimestampColumns,
    createAuditColumns,
    createLifecycleColumn,
    createModerationColumn,
    createVisibilityColumn,
    createFeaturedColumn,
    createEntityRefColumn,
    createNameColumn,
    mergeWithBaseColumns,
    STATUS_BADGE_OPTIONS,
    type BaseColumnsConfig
} from './createBaseColumns';

// Entity Layout Factory
export {
    createEntityLayout,
    createEntityLayoutWithPreset,
    COMMON_TAB_PRESETS,
    type EntityLayoutConfig,
    type EntityLayoutResult,
    type EntityTabConfig,
    type TabPresetKey
} from './createEntityLayout.tsx';

// Entity Routes Factory
export {
    createErrorComponent,
    createPendingComponent,
    createRouteComponents,
    createEntityLoader,
    RouteComponents,
    type EntityPageHookConfig,
    type CreateEntityPageHook
} from './createEntityRoutes.tsx';

// Entity Columns Factory (complete version with actions)
export {
    createEntityColumns,
    createActionColumn,
    createBadgeColumn,
    createEntityColumn,
    createNumberColumn,
    createBooleanColumn,
    ActionType,
    BADGE_OPTIONS,
    ACCOMMODATION_TYPE_OPTIONS,
    EVENT_TYPE_OPTIONS,
    type ActionConfig,
    type ActionColumnResult,
    type ActionType as ActionTypeEnum,
    type CreateEntityColumnsConfig,
    type EntityColumnsResult,
    type ExtendedColumnConfig,
    type NameColumnConfig,
    type PreparedAction
} from './createEntityColumns';

// Re-export existing factories from other locations for convenience
export { createEntityQueryKeys } from '@/lib/query-keys/factory';
export { createEntityApi } from '@/components/entity-list/api/createEntityApi';
export { createEntityListPage } from '@/components/entity-list/EntityListPage';

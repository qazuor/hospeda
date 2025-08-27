/**
 * Generic entity list components and utilities
 */

export { createEntityApi } from './api/createEntityApi';
export {
    BulkOperationsToolbar,
    SelectAllCheckbox,
    SelectionCheckbox
} from './BulkOperationsToolbar';
export { createEntityListPage } from './EntityListPage';
export { useBulkOperations } from './hooks/useBulkOperations';
export { useEntityListMutations } from './hooks/useEntityListMutations';
export { useEntityQuery } from './hooks/useEntityQuery';

// Export virtualization
export {
    useVirtualizedEntityQuery,
    VIRTUALIZED_QUERY_PRESETS
} from './hooks/useVirtualizedEntityQuery';
export { useVirtualizedList, VIRTUALIZATION_PRESETS } from './hooks/useVirtualizedList';
export {
    DefaultEmptyState,
    DefaultErrorState,
    DefaultLoadingState,
    VirtualizedEntityList
} from './VirtualizedEntityList';
export { SimpleVirtualizedList, VirtualizedEntityListPage } from './VirtualizedEntityListPage';

// Export examples
export {
    generateMockEntities,
    VirtualizedEntityListDemo,
    VirtualizedEntityListExample
} from './examples/VirtualizedEntityListExample';

export type * from './types';

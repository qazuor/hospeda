/**
 * Table Utilities
 *
 * Provides table-related utilities including state persistence.
 *
 * @example
 * ```typescript
 * import { useTablePersistence, useSortingPersistence } from '@/lib/table';
 *
 * // Full table persistence
 * const { state, setState, resetState } = useTablePersistence({
 *   key: 'my-table',
 *   strategy: 'localStorage',
 *   defaultState: { sorting: [], pagination: { pageIndex: 0, pageSize: 20 } }
 * });
 *
 * // Just sorting persistence
 * const { sorting, setSorting } = useSortingPersistence('my-table');
 * ```
 */

export {
    // Types
    type SortingState,
    type PaginationState,
    type ColumnVisibilityState,
    type ColumnFilter,
    type TableState,
    type PersistenceStrategy,
    type TablePersistenceConfig,
    type UseTablePersistenceResult,
    // Main hook
    useTablePersistence,
    // Utility hooks
    useSortingPersistence,
    usePaginationPersistence,
    useColumnVisibilityPersistence
} from './table-persistence';

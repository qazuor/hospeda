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
    type ColumnFilter,
    type ColumnVisibilityState,
    type PaginationState,
    type PersistenceStrategy,
    // Types
    type SortingState,
    type TablePersistenceConfig,
    type TableState,
    type UseTablePersistenceResult,
    useColumnVisibilityPersistence,
    usePaginationPersistence,
    // Utility hooks
    useSortingPersistence,
    // Main hook
    useTablePersistence
} from './table-persistence';

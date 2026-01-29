/**
 * Table Persistence System
 *
 * Provides persistent storage for table state (sorting, filtering, pagination,
 * column visibility) across page reloads and navigations.
 *
 * Supports multiple storage strategies:
 * - localStorage: Persists across browser sessions
 * - sessionStorage: Persists within current tab session
 *
 * @example
 * ```typescript
 * import { useTablePersistence } from '@/lib/table';
 *
 * function AccommodationsTable() {
 *   const { state, setState, resetState } = useTablePersistence({
 *     key: 'accommodations-table',
 *     strategy: 'localStorage',
 *     defaultState: {
 *       sorting: [{ id: 'name', desc: false }],
 *       columnVisibility: { description: false },
 *       pagination: { pageIndex: 0, pageSize: 20 }
 *     }
 *   });
 *
 *   const table = useReactTable({
 *     ...options,
 *     state: {
 *       sorting: state.sorting,
 *       columnVisibility: state.columnVisibility,
 *       pagination: state.pagination
 *     },
 *     onSortingChange: (updater) => setState({ sorting: updater(state.sorting) }),
 *     onColumnVisibilityChange: (updater) => setState({ columnVisibility: updater(state.columnVisibility) }),
 *     onPaginationChange: (updater) => setState({ pagination: updater(state.pagination) })
 *   });
 * }
 * ```
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { adminLogger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Sorting state for a single column
 */
export interface SortingState {
    id: string;
    desc: boolean;
}

/**
 * Pagination state
 */
export interface PaginationState {
    pageIndex: number;
    pageSize: number;
}

/**
 * Column visibility state
 */
export type ColumnVisibilityState = Record<string, boolean>;

/**
 * Column filter state
 */
export interface ColumnFilter {
    id: string;
    value: unknown;
}

/**
 * Complete table state
 */
export interface TableState {
    /** Sorting configuration */
    sorting?: SortingState[];
    /** Pagination configuration */
    pagination?: PaginationState;
    /** Column visibility */
    columnVisibility?: ColumnVisibilityState;
    /** Column filters */
    columnFilters?: ColumnFilter[];
    /** Global filter */
    globalFilter?: string;
    /** Row selection */
    rowSelection?: Record<string, boolean>;
}

/**
 * Storage strategy type
 */
export type PersistenceStrategy = 'localStorage' | 'sessionStorage';

/**
 * Configuration for table persistence
 */
export interface TablePersistenceConfig {
    /** Unique key for this table's persisted state */
    key: string;
    /** Storage strategy to use */
    strategy: PersistenceStrategy;
    /** Default state when no persisted state exists */
    defaultState?: TableState;
    /** Schema version for migration handling */
    version?: number;
    /** Fields to persist (default: all) */
    persistFields?: Array<keyof TableState>;
}

/**
 * Return type of useTablePersistence hook
 */
export interface UseTablePersistenceResult {
    /** Current table state */
    state: TableState;
    /** Update table state (partial update) */
    setState: (updates: Partial<TableState>) => void;
    /** Reset to default state */
    resetState: () => void;
    /** Whether initial state has been loaded */
    isLoaded: boolean;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

const sortingStateSchema = z.object({
    id: z.string(),
    desc: z.boolean()
});

const paginationStateSchema = z.object({
    pageIndex: z.number().int().min(0),
    pageSize: z.number().int().min(1).max(100)
});

const columnFilterSchema = z.object({
    id: z.string(),
    value: z.unknown()
});

const tableStateSchema = z.object({
    sorting: z.array(sortingStateSchema).optional(),
    pagination: paginationStateSchema.optional(),
    columnVisibility: z.record(z.string(), z.boolean()).optional(),
    columnFilters: z.array(columnFilterSchema).optional(),
    globalFilter: z.string().optional(),
    rowSelection: z.record(z.string(), z.boolean()).optional()
});

// ============================================================================
// Storage Adapters
// ============================================================================

/**
 * Storage adapter interface
 */
interface StorageAdapter {
    load(key: string): TableState | null;
    save(key: string, state: TableState): void;
    remove(key: string): void;
}

/**
 * Create a localStorage adapter
 */
function createLocalStorageAdapter(): StorageAdapter {
    const PREFIX = 'table-state:';

    return {
        load(key: string): TableState | null {
            if (typeof window === 'undefined') return null;

            try {
                const stored = localStorage.getItem(`${PREFIX}${key}`);
                if (!stored) return null;

                const parsed = JSON.parse(stored);
                const validated = tableStateSchema.safeParse(parsed);

                if (validated.success) {
                    return validated.data as TableState;
                }

                // Invalid data, remove it
                localStorage.removeItem(`${PREFIX}${key}`);
                return null;
            } catch {
                return null;
            }
        },

        save(key: string, state: TableState): void {
            if (typeof window === 'undefined') return;

            try {
                localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(state));
            } catch (error) {
                // Handle quota exceeded
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    adminLogger.warn('localStorage quota exceeded - table state not saved');
                }
            }
        },

        remove(key: string): void {
            if (typeof window === 'undefined') return;
            localStorage.removeItem(`${PREFIX}${key}`);
        }
    };
}

/**
 * Create a sessionStorage adapter
 */
function createSessionStorageAdapter(): StorageAdapter {
    const PREFIX = 'table-state:';

    return {
        load(key: string): TableState | null {
            if (typeof window === 'undefined') return null;

            try {
                const stored = sessionStorage.getItem(`${PREFIX}${key}`);
                if (!stored) return null;

                const parsed = JSON.parse(stored);
                const validated = tableStateSchema.safeParse(parsed);

                if (validated.success) {
                    return validated.data as TableState;
                }

                sessionStorage.removeItem(`${PREFIX}${key}`);
                return null;
            } catch {
                return null;
            }
        },

        save(key: string, state: TableState): void {
            if (typeof window === 'undefined') return;

            try {
                sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(state));
            } catch (error) {
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    adminLogger.warn('sessionStorage quota exceeded - table state not saved');
                }
            }
        },

        remove(key: string): void {
            if (typeof window === 'undefined') return;
            sessionStorage.removeItem(`${PREFIX}${key}`);
        }
    };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for persisting table state
 *
 * @example
 * ```typescript
 * const { state, setState, resetState } = useTablePersistence({
 *   key: 'accommodations-table',
 *   strategy: 'localStorage',
 *   defaultState: {
 *     sorting: [{ id: 'createdAt', desc: true }],
 *     pagination: { pageIndex: 0, pageSize: 20 }
 *   }
 * });
 * ```
 */
export function useTablePersistence(config: TablePersistenceConfig): UseTablePersistenceResult {
    const { key, strategy, defaultState = {}, persistFields } = config;

    // State
    const [state, setStateInternal] = useState<TableState>(defaultState);
    const [isLoaded, setIsLoaded] = useState(false);

    // Get adapter based on strategy
    const adapter = useMemo(() => {
        switch (strategy) {
            case 'localStorage':
                return createLocalStorageAdapter();
            case 'sessionStorage':
                return createSessionStorageAdapter();
            default:
                return createLocalStorageAdapter();
        }
    }, [strategy]);

    // Load initial state
    useEffect(() => {
        const loadedState = adapter.load(key);

        if (loadedState) {
            setStateInternal({ ...defaultState, ...loadedState });
        }

        setIsLoaded(true);
    }, [key, adapter, defaultState]);

    // Persist state changes
    const persistState = useCallback(
        (newState: TableState) => {
            // Filter to only persist specified fields
            let stateToPersist = newState;
            if (persistFields) {
                stateToPersist = {};
                for (const field of persistFields) {
                    if (newState[field] !== undefined) {
                        (stateToPersist as Record<string, unknown>)[field] = newState[field];
                    }
                }
            }

            adapter.save(key, stateToPersist);
        },
        [key, adapter, persistFields]
    );

    // Persist on state changes
    useEffect(() => {
        if (!isLoaded) return;
        persistState(state);
    }, [state, isLoaded, persistState]);

    // Update state handler
    const setState = useCallback((updates: Partial<TableState>) => {
        setStateInternal((prev) => ({
            ...prev,
            ...updates
        }));
    }, []);

    // Reset state handler
    const resetState = useCallback(() => {
        setStateInternal(defaultState);
        adapter.remove(key);
    }, [key, adapter, defaultState]);

    return {
        state,
        setState,
        resetState,
        isLoaded
    };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook specifically for sorting persistence
 */
export function useSortingPersistence(
    key: string,
    defaultSorting: SortingState[] = [],
    strategy: PersistenceStrategy = 'localStorage'
) {
    const { state, setState, resetState, isLoaded } = useTablePersistence({
        key: `${key}-sorting`,
        strategy,
        defaultState: { sorting: defaultSorting },
        persistFields: ['sorting']
    });

    return {
        sorting: state.sorting ?? defaultSorting,
        setSorting: (sorting: SortingState[]) => setState({ sorting }),
        resetSorting: resetState,
        isLoaded
    };
}

/**
 * Hook specifically for pagination persistence
 */
export function usePaginationPersistence(
    key: string,
    defaultPagination: PaginationState = { pageIndex: 0, pageSize: 20 },
    strategy: PersistenceStrategy = 'localStorage'
) {
    const { state, setState, resetState, isLoaded } = useTablePersistence({
        key: `${key}-pagination`,
        strategy,
        defaultState: { pagination: defaultPagination },
        persistFields: ['pagination']
    });

    return {
        pagination: state.pagination ?? defaultPagination,
        setPagination: (pagination: PaginationState) => setState({ pagination }),
        resetPagination: resetState,
        isLoaded
    };
}

/**
 * Hook specifically for column visibility persistence
 */
export function useColumnVisibilityPersistence(
    key: string,
    defaultVisibility: ColumnVisibilityState = {},
    strategy: PersistenceStrategy = 'localStorage'
) {
    const { state, setState, resetState, isLoaded } = useTablePersistence({
        key: `${key}-columns`,
        strategy,
        defaultState: { columnVisibility: defaultVisibility },
        persistFields: ['columnVisibility']
    });

    return {
        columnVisibility: state.columnVisibility ?? defaultVisibility,
        setColumnVisibility: (visibility: ColumnVisibilityState) =>
            setState({ columnVisibility: visibility }),
        resetColumnVisibility: resetState,
        isLoaded
    };
}

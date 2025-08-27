import { useToast } from '@/components/ui/ToastProvider';
import { useCallback, useState } from 'react';
import { useEntityListMutations } from './useEntityListMutations';

type BulkOperationConfig = {
    readonly entityName: string;
    readonly displayName: string;
    readonly pluralDisplayName: string;
    readonly updateEndpoint?: string;
    readonly deleteEndpoint?: string;
    readonly bulkUpdateEndpoint?: string;
    readonly bulkDeleteEndpoint?: string;
};

type BulkOperationState = {
    readonly selectedIds: Set<string>;
    readonly isSelecting: boolean;
    readonly operation: 'update' | 'delete' | null;
};

/**
 * Hook to manage bulk operations with optimistic updates and selection state
 * Provides a complete solution for bulk operations in entity lists
 */
export const useBulkOperations = <TData extends { id: string }>(config: BulkOperationConfig) => {
    const { addToast } = useToast();
    const [state, setState] = useState<BulkOperationState>({
        selectedIds: new Set(),
        isSelecting: false,
        operation: null
    });

    const {
        bulkUpdateEntities,
        bulkDeleteEntities,
        bulkUpdateEntitiesAsync,
        bulkDeleteEntitiesAsync,
        isBulkUpdating,
        isBulkDeleting,
        bulkUpdateError,
        bulkDeleteError,
        resetBulkUpdate,
        resetBulkDelete
    } = useEntityListMutations({
        entityName: config.entityName,
        updateEndpoint: config.updateEndpoint,
        deleteEndpoint: config.deleteEndpoint,
        bulkUpdateEndpoint: config.bulkUpdateEndpoint,
        bulkDeleteEndpoint: config.bulkDeleteEndpoint,
        onSuccess: (operation, _data) => {
            const count = state.selectedIds.size;
            const items = count === 1 ? config.displayName : config.pluralDisplayName;

            if (operation === 'bulkUpdate') {
                addToast({
                    variant: 'success',
                    title: 'Bulk Update Successful',
                    message: `Successfully updated ${count} ${items.toLowerCase()}`
                });
            } else if (operation === 'bulkDelete') {
                addToast({
                    variant: 'success',
                    title: 'Bulk Delete Successful',
                    message: `Successfully deleted ${count} ${items.toLowerCase()}`
                });
            }

            // Clear selection after successful operation
            clearSelection();
        },
        onError: (operation, error) => {
            const count = state.selectedIds.size;
            const items = count === 1 ? config.displayName : config.pluralDisplayName;

            if (operation === 'bulkUpdate') {
                addToast({
                    variant: 'error',
                    title: 'Bulk Update Failed',
                    message: `Failed to update ${count} ${items.toLowerCase()}. ${error.message}`,
                    durationMs: 8000
                });
            } else if (operation === 'bulkDelete') {
                addToast({
                    variant: 'error',
                    title: 'Bulk Delete Failed',
                    message: `Failed to delete ${count} ${items.toLowerCase()}. ${error.message}`,
                    durationMs: 8000
                });
            }
        }
    });

    // Selection management
    const toggleSelection = useCallback((id: string) => {
        setState((prev) => {
            const newSelectedIds = new Set(prev.selectedIds);
            if (newSelectedIds.has(id)) {
                newSelectedIds.delete(id);
            } else {
                newSelectedIds.add(id);
            }
            return {
                ...prev,
                selectedIds: newSelectedIds
            };
        });
    }, []);

    const selectAll = useCallback((ids: string[]) => {
        setState((prev) => ({
            ...prev,
            selectedIds: new Set(ids)
        }));
    }, []);

    const clearSelection = useCallback(() => {
        setState((prev) => ({
            ...prev,
            selectedIds: new Set(),
            isSelecting: false,
            operation: null
        }));
    }, []);

    const toggleSelectMode = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isSelecting: !prev.isSelecting,
            selectedIds: prev.isSelecting ? new Set() : prev.selectedIds
        }));
    }, []);

    // Bulk operations
    const startBulkUpdate = useCallback(
        (data: Partial<TData>) => {
            if (state.selectedIds.size === 0) {
                addToast({
                    variant: 'error',
                    title: 'No Items Selected',
                    message: 'Please select items to update'
                });
                return;
            }

            setState((prev) => ({ ...prev, operation: 'update' }));

            const ids = Array.from(state.selectedIds);
            bulkUpdateEntities({ ids, data });
        },
        [state.selectedIds, bulkUpdateEntities, addToast]
    );

    const startBulkDelete = useCallback(() => {
        if (state.selectedIds.size === 0) {
            addToast({
                variant: 'error',
                title: 'No Items Selected',
                message: 'Please select items to delete'
            });
            return;
        }

        setState((prev) => ({ ...prev, operation: 'delete' }));

        const ids = Array.from(state.selectedIds);
        bulkDeleteEntities(ids);
    }, [state.selectedIds, bulkDeleteEntities, addToast]);

    // Async versions for more control
    const bulkUpdateAsync = useCallback(
        async (data: Partial<TData>) => {
            if (state.selectedIds.size === 0) {
                throw new Error('No items selected');
            }

            setState((prev) => ({ ...prev, operation: 'update' }));

            try {
                const ids = Array.from(state.selectedIds);
                const result = await bulkUpdateEntitiesAsync({ ids, data });
                return result;
            } finally {
                setState((prev) => ({ ...prev, operation: null }));
            }
        },
        [state.selectedIds, bulkUpdateEntitiesAsync]
    );

    const bulkDeleteAsync = useCallback(async () => {
        if (state.selectedIds.size === 0) {
            throw new Error('No items selected');
        }

        setState((prev) => ({ ...prev, operation: 'delete' }));

        try {
            const ids = Array.from(state.selectedIds);
            await bulkDeleteEntitiesAsync(ids);
        } finally {
            setState((prev) => ({ ...prev, operation: null }));
        }
    }, [state.selectedIds, bulkDeleteEntitiesAsync]);

    // Utility functions
    const isSelected = useCallback(
        (id: string) => {
            return state.selectedIds.has(id);
        },
        [state.selectedIds]
    );

    const getSelectedCount = useCallback(() => {
        return state.selectedIds.size;
    }, [state.selectedIds]);

    const getSelectedIds = useCallback(() => {
        return Array.from(state.selectedIds);
    }, [state.selectedIds]);

    const hasSelection = useCallback(() => {
        return state.selectedIds.size > 0;
    }, [state.selectedIds]);

    // Reset error states
    const resetErrors = useCallback(() => {
        resetBulkUpdate();
        resetBulkDelete();
    }, [resetBulkUpdate, resetBulkDelete]);

    return {
        // Selection state
        selectedIds: state.selectedIds,
        isSelecting: state.isSelecting,
        currentOperation: state.operation,

        // Selection actions
        toggleSelection,
        selectAll,
        clearSelection,
        toggleSelectMode,

        // Bulk operations
        bulkUpdate: startBulkUpdate,
        bulkDelete: startBulkDelete,
        bulkUpdateAsync,
        bulkDeleteAsync,

        // Status
        isBulkUpdating,
        isBulkDeleting,
        isOperationPending: isBulkUpdating || isBulkDeleting,

        // Errors
        bulkUpdateError,
        bulkDeleteError,
        hasErrors: !!bulkUpdateError || !!bulkDeleteError,
        resetErrors,

        // Utility functions
        isSelected,
        getSelectedCount,
        getSelectedIds,
        hasSelection,

        // Computed values
        selectedCount: state.selectedIds.size,
        canUpdate: state.selectedIds.size > 0 && !!config.bulkUpdateEndpoint,
        canDelete: state.selectedIds.size > 0 && !!config.bulkDeleteEndpoint
    };
};

import { OptimisticListItem } from '@/components/ui/OptimisticFeedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteIcon, EditIcon, ViewAllIcon } from '@repo/icons';
import { Link } from '@tanstack/react-router';
import {
    BulkOperationsToolbar,
    SelectAllCheckbox,
    SelectionCheckbox
} from '../BulkOperationsToolbar';
import { useBulkOperations } from '../hooks/useBulkOperations';
import { useEntityListMutations } from '../hooks/useEntityListMutations';
import { useEntityQuery } from '../hooks/useEntityQuery';
import type { EntityQueryParams, EntityQueryResponse } from '../types';

// Example entity type
type ExampleEntity = {
    readonly id: string;
    readonly name: string;
    readonly status: 'active' | 'inactive';
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly _isOptimistic?: boolean;
};

type OptimisticEntityListExampleProps = {
    readonly entityName: string;
    readonly displayName: string;
    readonly pluralDisplayName: string;
    readonly queryFn: (params: EntityQueryParams) => Promise<EntityQueryResponse<ExampleEntity>>;
    readonly updateEndpoint?: string;
    readonly deleteEndpoint?: string;
    readonly bulkUpdateEndpoint?: string;
    readonly bulkDeleteEndpoint?: string;
    readonly viewPath?: string;
    readonly editPath?: string;
};

/**
 * Example component showing how to use optimistic updates in entity lists
 * Demonstrates all the new optimistic update features
 */
export const OptimisticEntityListExample = ({
    entityName,
    displayName,
    pluralDisplayName,
    queryFn,
    updateEndpoint,
    deleteEndpoint,
    bulkUpdateEndpoint,
    bulkDeleteEndpoint,
    viewPath,
    editPath
}: OptimisticEntityListExampleProps) => {
    // Query for list data
    const { data, isLoading, error } = useEntityQuery(
        entityName,
        queryFn,
        { page: 1, pageSize: 10 } // Default params
    );

    // Individual item mutations
    const { updateEntity, deleteEntity, isUpdating, isDeleting, updateError, deleteError } =
        useEntityListMutations({
            entityName,
            updateEndpoint,
            deleteEndpoint,
            bulkUpdateEndpoint,
            bulkDeleteEndpoint
        });

    // Bulk operations
    const {
        selectedIds,
        isSelecting,
        currentOperation,
        isOperationPending,
        toggleSelection,
        selectAll,
        clearSelection,
        toggleSelectMode,
        bulkUpdate,
        bulkDelete,
        isSelected,
        selectedCount,
        canUpdate,
        canDelete
    } = useBulkOperations({
        entityName,
        displayName,
        pluralDisplayName,
        updateEndpoint,
        deleteEndpoint,
        bulkUpdateEndpoint,
        bulkDeleteEndpoint
    });

    const entities = data?.data || [];
    const allIds = entities.map((entity) => entity.id);

    // Handle individual item actions
    const handleToggleStatus = (entity: ExampleEntity) => {
        const newStatus = entity.status === 'active' ? 'inactive' : 'active';
        updateEntity({
            id: entity.id,
            data: { status: newStatus } as Partial<ExampleEntity>
        });
    };

    const handleDeleteItem = (id: string) => {
        if (confirm('Are you sure you want to delete this item?')) {
            deleteEntity(id);
        }
    };

    // Handle bulk operations
    const handleBulkActivate = () => {
        bulkUpdate({ status: 'active' } as Partial<ExampleEntity>);
    };

    const handleBulkDeactivate = () => {
        bulkUpdate({ status: 'inactive' } as Partial<ExampleEntity>);
    };

    const handleBulkDelete = () => {
        if (confirm(`Are you sure you want to delete ${selectedCount} items?`)) {
            bulkDelete();
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <div className="animate-pulse">Loading {pluralDisplayName}...</div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-red-600">
                    Error loading {pluralDisplayName}: {error.message}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="font-bold text-2xl">{pluralDisplayName}</h1>
                <div className="flex items-center space-x-2">
                    <span className="text-gray-600 text-sm">{entities.length} items</span>
                </div>
            </div>

            {/* Bulk Operations Toolbar */}
            <BulkOperationsToolbar
                selectedCount={selectedCount}
                isSelecting={isSelecting}
                isOperationPending={isOperationPending}
                currentOperation={currentOperation}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onToggleSelectMode={toggleSelectMode}
                onClearSelection={clearSelection}
                onBulkDelete={handleBulkDelete}
                customActions={
                    <div className="flex items-center space-x-2">
                        {selectedCount > 0 && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleBulkActivate}
                                    disabled={isOperationPending}
                                >
                                    Activate Selected
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleBulkDeactivate}
                                    disabled={isOperationPending}
                                >
                                    Deactivate Selected
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            {/* List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>{pluralDisplayName}</span>
                        <SelectAllCheckbox
                            allIds={allIds}
                            selectedIds={selectedIds}
                            isSelecting={isSelecting}
                            onSelectAll={selectAll}
                            onClearSelection={clearSelection}
                        />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {entities.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">
                            No {pluralDisplayName.toLowerCase()} found
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {entities.map((entity) => (
                                <OptimisticListItem
                                    key={entity.id}
                                    isOptimistic={entity._isOptimistic}
                                    isUpdating={isUpdating}
                                    isDeleting={isDeleting}
                                    hasError={!!updateError || !!deleteError}
                                    className="p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <SelectionCheckbox
                                                id={entity.id}
                                                isSelected={isSelected(entity.id)}
                                                isSelecting={isSelecting}
                                                onToggle={toggleSelection}
                                            />

                                            <div>
                                                <h3 className="font-medium">{entity.name}</h3>
                                                <div className="flex items-center space-x-2 text-gray-500 text-sm">
                                                    <span
                                                        className={`inline-block h-2 w-2 rounded-full ${
                                                            entity.status === 'active'
                                                                ? 'bg-green-500'
                                                                : 'bg-gray-400'
                                                        }`}
                                                    />
                                                    <span className="capitalize">
                                                        {entity.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            {/* Toggle Status */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleStatus(entity)}
                                                disabled={isOperationPending}
                                            >
                                                {entity.status === 'active'
                                                    ? 'Deactivate'
                                                    : 'Activate'}
                                            </Button>

                                            {/* View */}
                                            {viewPath && (
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <Link
                                                        to={viewPath}
                                                        params={{ id: entity.id }}
                                                    >
                                                        <ViewAllIcon className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            )}

                                            {/* Edit */}
                                            {editPath && (
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <Link
                                                        to={editPath}
                                                        params={{ id: entity.id }}
                                                    >
                                                        <EditIcon className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            )}

                                            {/* Delete */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteItem(entity.id)}
                                                disabled={isOperationPending}
                                                className="border-red-200 text-red-700 hover:bg-red-50"
                                            >
                                                <DeleteIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </OptimisticListItem>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

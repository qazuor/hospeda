import { BulkOperationFeedback } from '@/components/ui/OptimisticFeedback';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { CheckInIcon, CloseIcon, DeleteIcon } from '@repo/icons';
import type { ReactNode } from 'react';

type BulkOperationsToolbarProps = {
    readonly selectedCount: number;
    readonly isSelecting: boolean;
    readonly isOperationPending: boolean;
    readonly currentOperation: 'update' | 'delete' | null;
    readonly canUpdate: boolean;
    readonly canDelete: boolean;
    readonly onToggleSelectMode: () => void;
    readonly onClearSelection: () => void;
    readonly onBulkUpdate?: () => void;
    readonly onBulkDelete?: () => void;
    readonly customActions?: ReactNode;
    readonly className?: string;
};

/**
 * Toolbar component for bulk operations with optimistic feedback
 * Provides a clean interface for managing bulk operations on entity lists
 */
export const BulkOperationsToolbar = ({
    selectedCount,
    isSelecting,
    isOperationPending,
    currentOperation,
    canUpdate,
    canDelete,
    onToggleSelectMode,
    onClearSelection,
    onBulkUpdate,
    onBulkDelete,
    customActions,
    className
}: BulkOperationsToolbarProps) => {
    const { t, tPlural } = useTranslations();

    if (!isSelecting && selectedCount === 0) {
        return (
            <div className={`flex items-center justify-between ${className || ''}`}>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToggleSelectMode}
                    >
                        <CheckInIcon className="mr-2 h-4 w-4" />
                        {t('admin-common.bulkToolbar.selectItems')}
                    </Button>
                </div>
                {customActions}
            </div>
        );
    }

    return (
        <>
            <div
                className={`flex items-center justify-between rounded-lg border bg-primary/5 p-4 ${className || ''}`}
            >
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <CheckInIcon className="h-5 w-5 text-primary" />
                        <span className="font-medium text-primary">
                            {tPlural('admin-common.bulkToolbar.itemsSelected', selectedCount)}
                        </span>
                    </div>

                    <div className="flex items-center space-x-2">
                        {canUpdate && onBulkUpdate && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onBulkUpdate}
                                disabled={isOperationPending}
                            >
                                {t('admin-common.bulkToolbar.updateSelected')}
                            </Button>
                        )}

                        {canDelete && onBulkDelete && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onBulkDelete}
                                disabled={isOperationPending}
                                className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                            >
                                <DeleteIcon className="mr-2 h-4 w-4" />
                                {t('admin-common.bulkToolbar.deleteSelected')}
                            </Button>
                        )}

                        {customActions}
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearSelection}
                        disabled={isOperationPending}
                    >
                        <CloseIcon className="mr-2 h-4 w-4" />
                        {t('admin-common.bulkToolbar.clearSelection')}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleSelectMode}
                        disabled={isOperationPending}
                    >
                        {t('admin-common.bulkToolbar.exitSelectMode')}
                    </Button>
                </div>
            </div>

            {/* Floating feedback for bulk operations */}
            <BulkOperationFeedback
                operation={currentOperation}
                selectedCount={selectedCount}
                isPending={isOperationPending}
                isSuccess={false} // This would be managed by the parent component
                isError={false} // This would be managed by the parent component
            />
        </>
    );
};

/**
 * Checkbox component for individual item selection
 */
type SelectionCheckboxProps = {
    readonly id: string;
    readonly isSelected: boolean;
    readonly isSelecting: boolean;
    readonly onToggle: (id: string) => void;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly ariaLabel?: string;
};

export const SelectionCheckbox = ({
    id,
    isSelected,
    isSelecting,
    onToggle,
    disabled = false,
    className,
    ariaLabel
}: SelectionCheckboxProps) => {
    if (!isSelecting) return null;

    return (
        <div className={`flex items-center ${className || ''}`}>
            <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(id)}
                disabled={disabled}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                aria-label={ariaLabel ?? `Select item ${id}`}
            />
        </div>
    );
};

/**
 * Select all checkbox for table headers
 */
type SelectAllCheckboxProps = {
    readonly allIds: string[];
    readonly selectedIds: Set<string>;
    readonly isSelecting: boolean;
    readonly onSelectAll: (ids: string[]) => void;
    readonly onClearSelection: () => void;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly ariaLabel?: string;
};

export const SelectAllCheckbox = ({
    allIds,
    selectedIds,
    isSelecting,
    onSelectAll,
    onClearSelection,
    disabled = false,
    className,
    ariaLabel
}: SelectAllCheckboxProps) => {
    if (!isSelecting) return null;

    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
    const someSelected = allIds.some((id) => selectedIds.has(id));
    const indeterminate = someSelected && !allSelected;

    const handleChange = () => {
        if (allSelected) {
            onClearSelection();
        } else {
            onSelectAll(allIds);
        }
    };

    return (
        <div className={`flex items-center ${className || ''}`}>
            <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                    if (el) el.indeterminate = indeterminate;
                }}
                onChange={handleChange}
                disabled={disabled || allIds.length === 0}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                aria-label={ariaLabel ?? 'Select all items'}
            />
        </div>
    );
};

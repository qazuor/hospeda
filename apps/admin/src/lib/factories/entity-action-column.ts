/**
 * Entity Action Column Factory
 *
 * Creates action columns for entity data tables with view, edit, delete,
 * soft-delete, restore, and duplicate action types.
 */
import type { ColumnConfig } from '@/components/entity-list/types';
import { ColumnType } from '@/components/table/DataTable';

// ============================================================================
// Types
// ============================================================================

/**
 * Available action types for entity rows
 */
export enum ActionType {
    VIEW = 'view',
    EDIT = 'edit',
    DELETE = 'delete',
    SOFT_DELETE = 'softDelete',
    RESTORE = 'restore',
    DUPLICATE = 'duplicate'
}

/**
 * Action column configuration
 */
export interface ActionConfig<TData> {
    /** Action type */
    readonly type: ActionType;
    /** Custom label override */
    readonly label?: string;
    /** Custom icon name */
    readonly icon?: string;
    /** Condition for showing the action */
    readonly showWhen?: (row: TData) => boolean;
    /** Custom click handler */
    readonly onClick?: (row: TData) => void;
    /** Confirmation required */
    readonly requireConfirmation?: boolean;
    /** Confirmation message */
    readonly confirmationMessage?: string;
}

/**
 * Prepared action with resolved labels and icons
 */
export interface PreparedAction<TData> {
    readonly type: ActionType;
    readonly label: string;
    readonly icon: string;
    readonly showWhen?: (row: TData) => boolean;
    readonly onClick?: (row: TData) => void;
    readonly requireConfirmation: boolean;
    readonly confirmationMessage?: string;
    readonly route?: string;
}

/**
 * Action column result with metadata for custom rendering
 */
export interface ActionColumnResult<TData> extends ColumnConfig<TData> {
    /** Prepared actions with resolved labels and icons */
    readonly __actions: readonly PreparedAction<TData>[];
    /** Base path for entity routes */
    readonly __basePath: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default action labels
 */
const ACTION_LABELS: Record<ActionType, string> = {
    [ActionType.VIEW]: 'View',
    [ActionType.EDIT]: 'Edit',
    [ActionType.DELETE]: 'Delete',
    [ActionType.SOFT_DELETE]: 'Archive',
    [ActionType.RESTORE]: 'Restore',
    [ActionType.DUPLICATE]: 'Duplicate'
};

/**
 * Default action icons (Lucide icon names)
 */
const ACTION_ICONS: Record<ActionType, string> = {
    [ActionType.VIEW]: 'Eye',
    [ActionType.EDIT]: 'Pencil',
    [ActionType.DELETE]: 'Trash2',
    [ActionType.SOFT_DELETE]: 'Archive',
    [ActionType.RESTORE]: 'RotateCcw',
    [ActionType.DUPLICATE]: 'Copy'
};

// ============================================================================
// Factory
// ============================================================================

/**
 * Normalize action configuration
 */
function normalizeAction<TData>(action: ActionType | ActionConfig<TData>): ActionConfig<TData> {
    if (typeof action === 'string') {
        return { type: action };
    }
    return action;
}

/**
 * Create action column with row actions
 *
 * The action column uses ColumnType.WIDGET and renders action labels.
 * For interactive buttons, check `column.id === 'actions'` and access
 * the `__actions` metadata to build your own action UI.
 *
 * @example
 * ```tsx
 * const actionColumn = createActionColumn({
 *   basePath: '/accommodations',
 *   actions: [ActionType.VIEW, ActionType.EDIT, ActionType.DELETE]
 * });
 *
 * // In your table cell renderer:
 * if (column.id === 'actions' && '__actions' in column) {
 *   const actions = column.__actions;
 *   const basePath = column.__basePath;
 *   return <ActionsDropdown row={row} actions={actions} basePath={basePath} />;
 * }
 * ```
 */
export function createActionColumn<TData extends { id: string }>(config: {
    readonly basePath: string;
    readonly actions: readonly (ActionType | ActionConfig<TData>)[];
}): ActionColumnResult<TData> {
    const normalizedActions = config.actions.map(normalizeAction);

    // Prepare actions with resolved labels and icons
    const preparedActions: PreparedAction<TData>[] = normalizedActions.map((action) => ({
        type: action.type,
        label: action.label ?? ACTION_LABELS[action.type],
        icon: action.icon ?? ACTION_ICONS[action.type],
        showWhen: action.showWhen,
        onClick: action.onClick,
        requireConfirmation: action.requireConfirmation ?? action.type === ActionType.DELETE,
        confirmationMessage: action.confirmationMessage,
        route:
            action.type === ActionType.VIEW
                ? `${config.basePath}/$id`
                : action.type === ActionType.EDIT
                  ? `${config.basePath}/$id/edit`
                  : undefined
    }));

    return {
        id: 'actions',
        header: '',
        accessorKey: 'id',
        enableSorting: false,
        startVisibleOnTable: true,
        startVisibleOnGrid: true,
        columnType: ColumnType.WIDGET,
        // Widget renderer shows action labels as text
        // For interactive UI, consumers should check column.id === 'actions'
        widgetRenderer: (row: TData) => {
            const visibleActions = preparedActions.filter(
                (action) => !action.showWhen || action.showWhen(row)
            );
            // Return text representation of available actions
            return visibleActions.map((a) => a.label).join(' | ');
        },
        // Metadata for custom action rendering
        __actions: preparedActions,
        __basePath: config.basePath
    };
}

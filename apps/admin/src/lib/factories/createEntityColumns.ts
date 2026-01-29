/**
 * Entity Columns Factory
 *
 * Complete factory for creating type-safe table columns with:
 * - Common base columns (timestamps, audit, lifecycle, moderation)
 * - Action columns (view, edit, delete)
 * - Custom column support
 * - Entity-specific presets
 *
 * @example
 * ```tsx
 * import { createEntityColumns, ActionType } from '@/lib/factories/createEntityColumns';
 *
 * const columns = createEntityColumns<Accommodation>({
 *   entityType: EntityType.ACCOMMODATION,
 *   basePath: '/accommodations',
 *   columns: [
 *     { id: 'name', header: 'Name', accessorKey: 'name', enableSorting: true },
 *     { id: 'type', header: 'Type', accessorKey: 'type', ... }
 *   ],
 *   actions: [ActionType.VIEW, ActionType.EDIT, ActionType.DELETE],
 *   baseColumns: {
 *     timestamps: true,
 *     lifecycle: true,
 *     moderation: true
 *   }
 * });
 * ```
 */

import type { ColumnConfig, LinkHandler } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, type EntityType } from '@/components/table/DataTable';
import {
    type BaseColumnsConfig,
    STATUS_BADGE_OPTIONS,
    createAllBaseColumns,
    createNameColumn
} from './createBaseColumns';

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
 * Custom renderer configuration
 */
export interface CustomRendererConfig<TData> {
    /** Renderer function */
    readonly render: (row: TData, value: unknown) => React.ReactNode;
}

/**
 * Extended column configuration with custom renderer
 */
export interface ExtendedColumnConfig<TData> extends ColumnConfig<TData> {
    /** Custom cell renderer */
    readonly customRenderer?: CustomRendererConfig<TData>;
}

/**
 * Name column configuration
 */
export interface NameColumnConfig<TData> {
    /** Entity type for badge */
    readonly entityType: EntityType;
    /** Path for links (e.g., '/accommodations') */
    readonly linkPath: string;
    /** Badge color */
    readonly color?: BadgeColor;
    /** Custom accessor key (default: 'name') */
    readonly accessorKey?: string;
    /** Custom header text (default: 'Name') */
    readonly header?: string;
    /** Link parameter key (default: 'id') */
    readonly linkParamKey?: 'id' | 'slug';
    /** Custom link handler */
    readonly linkHandler?: LinkHandler<TData>;
}

/**
 * Configuration for createEntityColumns factory
 */
export interface CreateEntityColumnsConfig<TData> {
    /** Entity type for default styling */
    readonly entityType: EntityType;
    /** Base path for entity routes (e.g., '/accommodations') */
    readonly basePath: string;
    /** Name column configuration (optional - adds at start) */
    readonly nameColumn?: NameColumnConfig<TData> | boolean;
    /** Entity-specific columns */
    readonly columns: readonly ExtendedColumnConfig<TData>[];
    /** Actions to include (creates action column at end) */
    readonly actions?: readonly (ActionType | ActionConfig<TData>)[];
    /** Base columns configuration */
    readonly baseColumns?: BaseColumnsConfig;
    /** Position for base columns (default: 'end') */
    readonly baseColumnsPosition?: 'start' | 'end';
    /** Position for action column (default: 'end') */
    readonly actionColumnPosition?: 'start' | 'end';
}

/**
 * Result of createEntityColumns
 */
export interface EntityColumnsResult<TData> {
    /** All columns combined */
    readonly columns: readonly ColumnConfig<TData>[];
    /** Just the entity-specific columns */
    readonly entityColumns: readonly ColumnConfig<TData>[];
    /** Just the base columns */
    readonly baseColumns: readonly ColumnConfig<TData>[];
    /** Just the action column (if any) */
    readonly actionColumn: ColumnConfig<TData> | null;
}

// ============================================================================
// Action Column Factory
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

// ============================================================================
// Preset Column Factories
// ============================================================================

/**
 * Create a badge column with predefined options
 */
export function createBadgeColumn<TData>(config: {
    readonly id: string;
    readonly header: string;
    readonly accessorKey: string;
    readonly options: readonly { value: string; label: string; color: BadgeColor }[];
    readonly enableSorting?: boolean;
    readonly startVisible?: boolean;
}): ColumnConfig<TData> {
    return {
        id: config.id,
        header: config.header,
        accessorKey: config.accessorKey as keyof TData & string,
        enableSorting: config.enableSorting ?? true,
        startVisibleOnTable: config.startVisible ?? true,
        startVisibleOnGrid: config.startVisible ?? true,
        columnType: ColumnType.BADGE,
        badgeOptions: config.options
    };
}

/**
 * Create entity reference column
 */
export function createEntityColumn<TData>(config: {
    readonly id: string;
    readonly header: string;
    readonly accessorKey: string;
    readonly entityType: EntityType;
    readonly color?: BadgeColor;
    readonly linkPath?: string;
    readonly linkParamKey?: 'id' | 'slug';
    readonly getLinkValue?: (row: TData) => string | undefined;
}): ColumnConfig<TData> {
    const column: ColumnConfig<TData> = {
        id: config.id,
        header: config.header,
        accessorKey: config.accessorKey as keyof TData & string,
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: config.entityType,
            color: config.color ?? BadgeColor.BLUE
        }
    };

    if (config.linkPath && config.getLinkValue) {
        return {
            ...column,
            linkHandler: (row: TData) => {
                const value = config.getLinkValue?.(row);
                if (!value) return undefined;
                return {
                    to: config.linkPath as string,
                    params: { [config.linkParamKey ?? 'id']: value }
                };
            }
        };
    }

    return column;
}

/**
 * Create a number column
 */
export function createNumberColumn<TData>(config: {
    readonly id: string;
    readonly header: string;
    readonly accessorKey: string;
    readonly enableSorting?: boolean;
    readonly startVisible?: boolean;
}): ColumnConfig<TData> {
    return {
        id: config.id,
        header: config.header,
        accessorKey: config.accessorKey as keyof TData & string,
        enableSorting: config.enableSorting ?? true,
        startVisibleOnTable: config.startVisible ?? true,
        startVisibleOnGrid: config.startVisible ?? false,
        columnType: ColumnType.NUMBER
    };
}

/**
 * Create a boolean column
 */
export function createBooleanColumn<TData>(config: {
    readonly id: string;
    readonly header: string;
    readonly accessorKey: string;
    readonly enableSorting?: boolean;
    readonly startVisible?: boolean;
}): ColumnConfig<TData> {
    return {
        id: config.id,
        header: config.header,
        accessorKey: config.accessorKey as keyof TData & string,
        enableSorting: config.enableSorting ?? true,
        startVisibleOnTable: config.startVisible ?? true,
        startVisibleOnGrid: config.startVisible ?? false,
        columnType: ColumnType.BOOLEAN
    };
}

// ============================================================================
// Main Factory
// ============================================================================

/**
 * Create complete entity columns configuration
 *
 * @example
 * ```tsx
 * const columns = createEntityColumns<Accommodation>({
 *   entityType: EntityType.ACCOMMODATION,
 *   basePath: '/accommodations',
 *   nameColumn: true, // Use defaults
 *   columns: [
 *     createBadgeColumn({
 *       id: 'type',
 *       header: 'Type',
 *       accessorKey: 'type',
 *       options: ACCOMMODATION_TYPE_OPTIONS
 *     }),
 *     createEntityColumn({
 *       id: 'destination',
 *       header: 'Destination',
 *       accessorKey: 'destination.name',
 *       entityType: EntityType.DESTINATION,
 *       linkPath: '/destinations/$slug',
 *       linkParamKey: 'slug',
 *       getLinkValue: (row) => row.destination?.slug
 *     })
 *   ],
 *   actions: [ActionType.VIEW, ActionType.EDIT, ActionType.DELETE],
 *   baseColumns: {
 *     timestamps: true,
 *     lifecycle: true,
 *     moderation: true
 *   }
 * });
 * ```
 */
export function createEntityColumns<TData extends { id: string; name?: string }>(
    config: CreateEntityColumnsConfig<TData>
): EntityColumnsResult<TData> {
    const {
        entityType,
        basePath,
        nameColumn,
        columns: entityColumns,
        actions,
        baseColumns: baseConfig,
        baseColumnsPosition = 'end',
        actionColumnPosition = 'end'
    } = config;

    // Build columns array
    const allColumns: ColumnConfig<TData>[] = [];

    // 1. Add name column if configured
    let nameCol: ColumnConfig<TData> | null = null;
    if (nameColumn) {
        if (nameColumn === true) {
            // Use defaults
            nameCol = createNameColumn<TData>({
                entityType,
                linkPath: `${basePath}/$id`,
                color: BadgeColor.BLUE
            });
        } else {
            // Use custom config
            nameCol = {
                id: 'name',
                header: nameColumn.header ?? 'Name',
                accessorKey: (nameColumn.accessorKey ?? 'name') as keyof TData & string,
                enableSorting: true,
                columnType: ColumnType.ENTITY,
                entityOptions: {
                    entityType: nameColumn.entityType,
                    color: nameColumn.color ?? BadgeColor.BLUE
                },
                linkHandler:
                    nameColumn.linkHandler ??
                    ((row: TData) => ({
                        to: nameColumn.linkPath,
                        params: { [nameColumn.linkParamKey ?? 'id']: (row as { id: string }).id }
                    }))
            };
        }
        allColumns.push(nameCol);
    }

    // 2. Create base columns
    const baseColumnsArray = baseConfig
        ? createAllBaseColumns<TData & { id: string }>(baseConfig)
        : [];

    // 3. Create action column
    let actionColumn: ColumnConfig<TData> | null = null;
    if (actions && actions.length > 0) {
        actionColumn = createActionColumn<TData>({
            basePath,
            actions
        });
    }

    // 4. Combine columns based on positions
    if (baseColumnsPosition === 'start') {
        allColumns.push(...(baseColumnsArray as ColumnConfig<TData>[]));
    }

    if (actionColumnPosition === 'start' && actionColumn) {
        allColumns.push(actionColumn);
    }

    // Add entity-specific columns
    allColumns.push(...entityColumns);

    if (baseColumnsPosition === 'end') {
        allColumns.push(...(baseColumnsArray as ColumnConfig<TData>[]));
    }

    if (actionColumnPosition === 'end' && actionColumn) {
        allColumns.push(actionColumn);
    }

    return {
        columns: allColumns,
        entityColumns,
        baseColumns: baseColumnsArray as readonly ColumnConfig<TData>[],
        actionColumn
    };
}

// ============================================================================
// Preset Options
// ============================================================================

/**
 * Common badge options for reuse
 */
export const BADGE_OPTIONS = {
    lifecycle: STATUS_BADGE_OPTIONS.lifecycle,
    moderation: STATUS_BADGE_OPTIONS.moderation,
    visibility: STATUS_BADGE_OPTIONS.visibility,
    publishStatus: STATUS_BADGE_OPTIONS.publishStatus
} as const;

/**
 * Common accommodation type options
 */
export const ACCOMMODATION_TYPE_OPTIONS = [
    { value: 'HOTEL', label: 'Hotel', color: BadgeColor.BLUE },
    { value: 'HOSTEL', label: 'Hostel', color: BadgeColor.CYAN },
    { value: 'APARTMENT', label: 'Apartment', color: BadgeColor.PURPLE },
    { value: 'HOUSE', label: 'House', color: BadgeColor.GREEN },
    { value: 'COUNTRY_HOUSE', label: 'Country House', color: BadgeColor.TEAL },
    { value: 'CABIN', label: 'Cabin', color: BadgeColor.ORANGE },
    { value: 'CAMPING', label: 'Camping', color: BadgeColor.YELLOW },
    { value: 'ROOM', label: 'Room', color: BadgeColor.PINK },
    { value: 'MOTEL', label: 'Motel', color: BadgeColor.INDIGO },
    { value: 'RESORT', label: 'Resort', color: BadgeColor.RED }
] as const;

/**
 * Common event type options
 */
export const EVENT_TYPE_OPTIONS = [
    { value: 'CONCERT', label: 'Concert', color: BadgeColor.PURPLE },
    { value: 'FESTIVAL', label: 'Festival', color: BadgeColor.ORANGE },
    { value: 'EXHIBITION', label: 'Exhibition', color: BadgeColor.BLUE },
    { value: 'CONFERENCE', label: 'Conference', color: BadgeColor.CYAN },
    { value: 'WORKSHOP', label: 'Workshop', color: BadgeColor.GREEN },
    { value: 'SPORTS', label: 'Sports', color: BadgeColor.RED },
    { value: 'THEATER', label: 'Theater', color: BadgeColor.PINK },
    { value: 'OTHER', label: 'Other', color: BadgeColor.GRAY }
] as const;

// ============================================================================
// Re-exports
// ============================================================================

export {
    createAllBaseColumns,
    createAuditColumns,
    createLifecycleColumn,
    createModerationColumn,
    createTimestampColumns,
    createVisibilityColumn,
    createFeaturedColumn,
    createNameColumn as createNameColumnBase
} from './createBaseColumns';

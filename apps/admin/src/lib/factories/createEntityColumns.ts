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
    createAllBaseColumns,
    createNameColumn
} from './createBaseColumns';
import { type ActionConfig, type ActionType, createActionColumn } from './entity-action-column';

// Re-export action types for consumers
export { ActionType, createActionColumn } from './entity-action-column';
export type { ActionConfig, ActionColumnResult, PreparedAction } from './entity-action-column';

// ============================================================================
// Types
// ============================================================================

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
// Re-exports
// ============================================================================

export {
    ACCOMMODATION_TYPE_OPTIONS,
    BADGE_OPTIONS,
    EVENT_TYPE_OPTIONS
} from './entity-column-presets';

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

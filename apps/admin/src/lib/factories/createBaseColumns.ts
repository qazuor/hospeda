import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';

/**
 * Common status values used across entities
 */
export const STATUS_BADGE_OPTIONS = {
    lifecycle: [
        { value: 'DRAFT', label: 'Draft', color: BadgeColor.GRAY },
        { value: 'ACTIVE', label: 'Active', color: BadgeColor.GREEN },
        { value: 'ARCHIVED', label: 'Archived', color: BadgeColor.ORANGE }
    ],
    moderation: [
        { value: 'PENDING', label: 'Pending', color: BadgeColor.YELLOW },
        { value: 'APPROVED', label: 'Approved', color: BadgeColor.GREEN },
        { value: 'REJECTED', label: 'Rejected', color: BadgeColor.RED }
    ],
    visibility: [
        { value: 'PUBLIC', label: 'Public', color: BadgeColor.PURPLE },
        { value: 'PRIVATE', label: 'Private', color: BadgeColor.CYAN },
        { value: 'RESTRICTED', label: 'Restricted', color: BadgeColor.PINK }
    ],
    publishStatus: [
        { value: 'DRAFT', label: 'Draft', color: BadgeColor.GRAY },
        { value: 'PUBLISHED', label: 'Published', color: BadgeColor.GREEN },
        { value: 'SCHEDULED', label: 'Scheduled', color: BadgeColor.BLUE },
        { value: 'UNPUBLISHED', label: 'Unpublished', color: BadgeColor.ORANGE }
    ]
} as const;

/**
 * Base entity interface for type constraints
 */
interface BaseEntity {
    id: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    createdBy?: { id: string; displayName?: string };
    updatedBy?: { id: string; displayName?: string };
    lifecycleState?: string;
    moderationState?: string;
    visibility?: string;
}

/**
 * Creates common timestamp columns
 */
export const createTimestampColumns = <
    TData extends BaseEntity
>(): readonly ColumnConfig<TData>[] =>
    [
        {
            id: 'createdAt',
            header: 'Created',
            accessorKey: 'createdAt' as keyof TData & string,
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'updatedAt',
            header: 'Updated',
            accessorKey: 'updatedAt' as keyof TData & string,
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        }
    ] as const;

/**
 * Creates common audit columns (createdBy, updatedBy)
 */
export const createAuditColumns = <TData extends BaseEntity>(): readonly ColumnConfig<TData>[] =>
    [
        {
            id: 'createdBy',
            header: 'Created By',
            accessorKey: 'createdBy.displayName' as keyof TData & string,
            enableSorting: false,
            columnType: ColumnType.ENTITY,
            entityOptions: {
                entityType: EntityType.USER,
                color: BadgeColor.PINK
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'updatedBy',
            header: 'Updated By',
            accessorKey: 'updatedBy.displayName' as keyof TData & string,
            enableSorting: false,
            columnType: ColumnType.ENTITY,
            entityOptions: {
                entityType: EntityType.USER,
                color: BadgeColor.PINK
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        }
    ] as const;

/**
 * Creates lifecycle state column
 */
export const createLifecycleColumn = <TData extends BaseEntity>(): ColumnConfig<TData> =>
    ({
        id: 'lifecycleState',
        header: 'Status',
        accessorKey: 'lifecycleState' as keyof TData & string,
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: STATUS_BADGE_OPTIONS.lifecycle
    }) as const;

/**
 * Creates moderation state column
 */
export const createModerationColumn = <TData extends BaseEntity>(): ColumnConfig<TData> =>
    ({
        id: 'moderationState',
        header: 'Moderation',
        accessorKey: 'moderationState' as keyof TData & string,
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: STATUS_BADGE_OPTIONS.moderation
    }) as const;

/**
 * Creates visibility column
 */
export const createVisibilityColumn = <TData extends BaseEntity>(): ColumnConfig<TData> =>
    ({
        id: 'visibility',
        header: 'Visibility',
        accessorKey: 'visibility' as keyof TData & string,
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: STATUS_BADGE_OPTIONS.visibility
    }) as const;

/**
 * Creates a featured boolean column
 */
export const createFeaturedColumn = <
    TData extends { isFeatured?: boolean }
>(): ColumnConfig<TData> =>
    ({
        id: 'isFeatured',
        header: 'Featured',
        accessorKey: 'isFeatured' as keyof TData & string,
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    }) as const;

/**
 * Creates an entity reference column with link
 */
export const createEntityRefColumn = <
    TData extends Record<string, unknown>,
    TRef extends { id?: string; name?: string; displayName?: string; slug?: string }
>(config: {
    id: string;
    header: string;
    accessorKey: string;
    entityType: EntityType;
    color?: BadgeColor;
    linkPath?: string;
    linkParamKey?: 'id' | 'slug';
    getRef?: (row: TData) => TRef | undefined;
}): ColumnConfig<TData> => {
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

    if (config.linkPath) {
        return {
            ...column,
            linkHandler: (row: TData) => {
                const ref = config.getRef ? config.getRef(row) : (row[config.id] as TRef);
                if (!ref) return undefined;

                const paramValue = config.linkParamKey === 'slug' ? ref.slug : ref.id;
                if (!paramValue) return undefined;

                return {
                    to: config.linkPath as string,
                    params: { [config.linkParamKey ?? 'id']: paramValue }
                };
            }
        };
    }

    return column;
};

/**
 * Creates a name column with entity link
 */
export const createNameColumn = <TData extends { id: string; name?: string }>(config: {
    entityType: EntityType;
    linkPath: string;
    color?: BadgeColor;
}): ColumnConfig<TData> =>
    ({
        id: 'name',
        header: 'Name',
        accessorKey: 'name' as keyof TData & string,
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: config.entityType,
            color: config.color ?? BadgeColor.BLUE
        },
        linkHandler: (row: TData) => ({
            to: config.linkPath,
            params: { id: row.id }
        })
    }) as const;

/**
 * Configuration for base columns factory
 */
export type BaseColumnsConfig = {
    /** Include timestamp columns (createdAt, updatedAt) */
    readonly timestamps?: boolean;
    /** Include audit columns (createdBy, updatedBy) */
    readonly audit?: boolean;
    /** Include lifecycle state column */
    readonly lifecycle?: boolean;
    /** Include moderation state column */
    readonly moderation?: boolean;
    /** Include visibility column */
    readonly visibility?: boolean;
    /** Include featured column */
    readonly featured?: boolean;
};

/**
 * Creates all base columns based on configuration
 *
 * @example
 * ```tsx
 * const columns = [
 *   // Entity-specific columns
 *   { id: 'name', header: 'Name', ... },
 *   { id: 'type', header: 'Type', ... },
 *
 *   // Add base columns
 *   ...createAllBaseColumns({
 *     timestamps: true,
 *     lifecycle: true,
 *     moderation: true
 *   })
 * ];
 * ```
 */
export const createAllBaseColumns = <TData extends BaseEntity>(
    config: BaseColumnsConfig = {}
): readonly ColumnConfig<TData>[] => {
    const columns: ColumnConfig<TData>[] = [];

    if (config.featured) {
        // Type assertion needed because TData extends BaseEntity, not necessarily { isFeatured }
        columns.push(createFeaturedColumn() as unknown as ColumnConfig<TData>);
    }

    if (config.visibility) {
        columns.push(createVisibilityColumn<TData>());
    }

    if (config.lifecycle) {
        columns.push(createLifecycleColumn<TData>());
    }

    if (config.moderation) {
        columns.push(createModerationColumn<TData>());
    }

    if (config.timestamps) {
        columns.push(...createTimestampColumns<TData>());
    }

    if (config.audit) {
        columns.push(...createAuditColumns<TData>());
    }

    return columns;
};

/**
 * Helper to merge entity-specific columns with base columns
 */
export const mergeWithBaseColumns = <TData extends BaseEntity>(
    entityColumns: readonly ColumnConfig<TData>[],
    baseConfig: BaseColumnsConfig = {}
): readonly ColumnConfig<TData>[] => {
    return [...entityColumns, ...createAllBaseColumns<TData>(baseConfig)];
};

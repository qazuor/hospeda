/**
 * @file Entity Columns Factory
 *
 * Factory functions to create reusable column configurations for entity lists.
 * Reduces boilerplate by providing pre-built columns for common patterns.
 *
 * @example
 * ```tsx
 * import { createEntityColumnsFactory } from '@/components/entity-list/columns.factory';
 *
 * const columnFactory = createEntityColumnsFactory<Accommodation>({
 *     entityType: EntityType.ACCOMMODATION,
 *     basePath: '/accommodations',
 *     idField: 'id',
 * });
 *
 * export const createAccommodationsColumns = () => [
 *     columnFactory.nameColumn({
 *         linkField: 'id',
 *         linkPattern: '/accommodations/$id',
 *     }),
 *     // Entity-specific columns
 *     columnFactory.custom({ id: 'type', ... }),
 *     // Common columns
 *     ...columnFactory.commonColumns(),
 * ];
 * ```
 */

import {
    BadgeColor,
    ColumnType,
    type EntityType,
    ListOrientation
} from '@/components/table/DataTable';
import type { ColumnConfig, LinkHandler } from './types';

/**
 * Badge option configuration
 */
export type BadgeOption = {
    readonly value: string;
    readonly label: string;
    readonly color: BadgeColor;
};

/**
 * Factory configuration
 */
export type ColumnFactoryConfig = {
    /** Entity type for styling */
    readonly entityType: EntityType;
    /** Base path for entity routes */
    readonly basePath: string;
    /** Primary color for entity badges */
    readonly primaryColor?: BadgeColor;
};

/**
 * Name column options
 */
export type NameColumnOptions<TData> = {
    /** Header text (default: 'Name') */
    readonly header?: string;
    /** Field to access for name value (default: 'name') */
    readonly accessorKey?: string;
    /** Field to use in link params */
    readonly linkField?: 'id' | 'slug';
    /** Custom link handler override */
    readonly linkHandler?: LinkHandler<TData>;
    /** Enable sorting (default: true) */
    readonly enableSorting?: boolean;
};

/**
 * Badge column options
 */
export type BadgeColumnOptions = {
    /** Column ID */
    readonly id: string;
    /** Header text */
    readonly header: string;
    /** Field to access for value */
    readonly accessorKey: string;
    /** Badge options for each value */
    readonly badgeOptions: readonly BadgeOption[];
    /** Enable sorting (default: true) */
    readonly enableSorting?: boolean;
    /** Visible on table by default */
    readonly startVisibleOnTable?: boolean;
    /** Visible on grid by default */
    readonly startVisibleOnGrid?: boolean;
};

// Note: TData in NameColumnOptions is intentionally unused but kept for future type safety
// when we add more specific type constraints

/**
 * Common visibility badge options
 */
export const VISIBILITY_BADGE_OPTIONS: readonly BadgeOption[] = [
    { value: 'PUBLIC', label: 'Public', color: BadgeColor.PURPLE },
    { value: 'PRIVATE', label: 'Private', color: BadgeColor.CYAN },
    { value: 'HIDDEN', label: 'Hidden', color: BadgeColor.PINK },
    { value: 'RESTRICTED', label: 'Restricted', color: BadgeColor.ORANGE }
];

/**
 * Common lifecycle state badge options
 */
export const LIFECYCLE_STATE_BADGE_OPTIONS: readonly BadgeOption[] = [
    { value: 'DRAFT', label: 'Draft', color: BadgeColor.GRAY },
    { value: 'ACTIVE', label: 'Active', color: BadgeColor.GREEN },
    { value: 'INACTIVE', label: 'Inactive', color: BadgeColor.YELLOW },
    { value: 'ARCHIVED', label: 'Archived', color: BadgeColor.ORANGE },
    { value: 'DELETED', label: 'Deleted', color: BadgeColor.RED }
];

/**
 * Common moderation state badge options
 */
export const MODERATION_STATE_BADGE_OPTIONS: readonly BadgeOption[] = [
    { value: 'PENDING', label: 'Pending', color: BadgeColor.YELLOW },
    { value: 'APPROVED', label: 'Approved', color: BadgeColor.GREEN },
    { value: 'REJECTED', label: 'Rejected', color: BadgeColor.RED },
    { value: 'UNDER_REVIEW', label: 'Under Review', color: BadgeColor.BLUE }
];

/**
 * Creates a column factory for a specific entity type
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic type for row data
export const createEntityColumnsFactory = <TData extends { id: string; [key: string]: any }>(
    config: ColumnFactoryConfig
) => {
    const { entityType, basePath, primaryColor = BadgeColor.BLUE } = config;

    return {
        /**
         * Creates a name column with entity styling and link
         */
        nameColumn: (options: NameColumnOptions<TData> = {}): ColumnConfig<TData> => {
            const {
                header = 'Name',
                accessorKey = 'name',
                linkField = 'id',
                enableSorting = true
            } = options;

            const defaultLinkHandler: LinkHandler<TData> = (row) => {
                const paramValue = row[linkField];
                if (!paramValue) return undefined;

                return {
                    to: `${basePath}/$${linkField}`,
                    params: { [linkField]: String(paramValue) }
                };
            };

            return {
                id: 'name',
                header,
                accessorKey,
                enableSorting,
                columnType: ColumnType.ENTITY,
                entityOptions: {
                    entityType,
                    color: primaryColor
                },
                linkHandler: options.linkHandler ?? defaultLinkHandler
            };
        },

        /**
         * Creates a boolean column (e.g., isFeatured)
         */
        booleanColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: { enableSorting?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: options.enableSorting ?? true,
            columnType: ColumnType.BOOLEAN
        }),

        /**
         * Creates a number column
         */
        numberColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: { enableSorting?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: options.enableSorting ?? true,
            columnType: ColumnType.NUMBER
        }),

        /**
         * Creates a string column
         */
        stringColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: { enableSorting?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: options.enableSorting ?? true,
            columnType: ColumnType.STRING
        }),

        /**
         * Creates a date column
         */
        dateColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: { enableSorting?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: options.enableSorting ?? true,
            columnType: ColumnType.DATE
        }),

        /**
         * Creates a time ago column (relative time)
         */
        timeAgoColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: { enableSorting?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: options.enableSorting ?? true,
            columnType: ColumnType.TIME_AGO
        }),

        /**
         * Creates a badge column with custom options
         */
        badgeColumn: (options: BadgeColumnOptions): ColumnConfig<TData> => ({
            id: options.id,
            header: options.header,
            accessorKey: options.accessorKey,
            enableSorting: options.enableSorting ?? true,
            columnType: ColumnType.BADGE,
            badgeOptions: options.badgeOptions,
            startVisibleOnTable: options.startVisibleOnTable,
            startVisibleOnGrid: options.startVisibleOnGrid
        }),

        /**
         * Creates an image column
         */
        imageColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: { startVisibleOnTable?: boolean; startVisibleOnGrid?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: false,
            columnType: ColumnType.IMAGE,
            startVisibleOnTable: options.startVisibleOnTable ?? false,
            startVisibleOnGrid: options.startVisibleOnGrid ?? true
        }),

        /**
         * Creates a gallery column
         */
        galleryColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: { startVisibleOnTable?: boolean; startVisibleOnGrid?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: false,
            columnType: ColumnType.GALLERY,
            startVisibleOnTable: options.startVisibleOnTable ?? false,
            startVisibleOnGrid: options.startVisibleOnGrid ?? true
        }),

        /**
         * Creates a list column
         */
        listColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: {
                listSeparator?: string;
                listOrientation?: ListOrientation;
                startVisibleOnTable?: boolean;
                startVisibleOnGrid?: boolean;
            } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: false,
            columnType: ColumnType.LIST,
            listSeparator: options.listSeparator ?? ' • ',
            listOrientation: options.listOrientation ?? ListOrientation.ROW,
            startVisibleOnTable: options.startVisibleOnTable ?? false,
            startVisibleOnGrid: options.startVisibleOnGrid ?? true
        }),

        /**
         * Creates a price column
         */
        priceColumn: (
            id: string,
            header: string,
            accessorKey: string,
            options: { enableSorting?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: options.enableSorting ?? true,
            columnType: ColumnType.PRICE
        }),

        /**
         * Creates an entity reference column (links to another entity)
         */
        entityRefColumn: (
            id: string,
            header: string,
            accessorKey: string,
            refEntityType: EntityType,
            linkHandler: LinkHandler<TData>,
            options: { color?: BadgeColor; enableSorting?: boolean } = {}
        ): ColumnConfig<TData> => ({
            id,
            header,
            accessorKey,
            enableSorting: options.enableSorting ?? false,
            columnType: ColumnType.ENTITY,
            entityOptions: {
                entityType: refEntityType,
                color: options.color ?? BadgeColor.GRAY
            },
            linkHandler
        }),

        /**
         * Creates a visibility badge column with standard options
         */
        visibilityColumn: (
            options: {
                startVisibleOnTable?: boolean;
                startVisibleOnGrid?: boolean;
            } = {}
        ): ColumnConfig<TData> => ({
            id: 'visibility',
            header: 'Visibility',
            accessorKey: 'visibility',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: VISIBILITY_BADGE_OPTIONS,
            startVisibleOnTable: options.startVisibleOnTable,
            startVisibleOnGrid: options.startVisibleOnGrid
        }),

        /**
         * Creates a lifecycle state badge column with standard options
         */
        lifecycleStateColumn: (
            options: {
                startVisibleOnTable?: boolean;
                startVisibleOnGrid?: boolean;
            } = {}
        ): ColumnConfig<TData> => ({
            id: 'lifecycleState',
            header: 'Status',
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: LIFECYCLE_STATE_BADGE_OPTIONS,
            startVisibleOnTable: options.startVisibleOnTable ?? false,
            startVisibleOnGrid: options.startVisibleOnGrid ?? true
        }),

        /**
         * Creates a moderation state badge column with standard options
         */
        moderationStateColumn: (
            options: {
                startVisibleOnTable?: boolean;
                startVisibleOnGrid?: boolean;
            } = {}
        ): ColumnConfig<TData> => ({
            id: 'moderationState',
            header: 'Moderation',
            accessorKey: 'moderationState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: MODERATION_STATE_BADGE_OPTIONS,
            startVisibleOnTable: options.startVisibleOnTable ?? false,
            startVisibleOnGrid: options.startVisibleOnGrid ?? false
        }),

        /**
         * Creates a featured boolean column
         */
        isFeaturedColumn: (): ColumnConfig<TData> => ({
            id: 'isFeatured',
            header: 'Featured',
            accessorKey: 'isFeatured',
            enableSorting: true,
            columnType: ColumnType.BOOLEAN
        }),

        /**
         * Creates a rating number column
         */
        ratingColumn: (accessorKey = 'averageRating'): ColumnConfig<TData> => ({
            id: 'averageRating',
            header: 'Rating',
            accessorKey,
            enableSorting: true,
            columnType: ColumnType.NUMBER
        }),

        /**
         * Creates a reviews count column
         */
        reviewsCountColumn: (accessorKey = 'reviewsCount'): ColumnConfig<TData> => ({
            id: 'reviewsCount',
            header: 'Reviews',
            accessorKey,
            enableSorting: true,
            columnType: ColumnType.NUMBER
        }),

        /**
         * Creates a created at time ago column
         */
        createdAtColumn: (): ColumnConfig<TData> => ({
            id: 'createdAt',
            header: 'Created',
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO
        }),

        /**
         * Creates a featured image column
         */
        featuredImageColumn: (accessorKey = 'media.featuredImage'): ColumnConfig<TData> => ({
            id: 'featuredImage',
            header: 'Featured Image',
            accessorKey,
            enableSorting: false,
            columnType: ColumnType.IMAGE,
            startVisibleOnTable: false,
            startVisibleOnGrid: true
        }),

        /**
         * Creates a gallery column
         */
        mediaGalleryColumn: (accessorKey = 'media.gallery'): ColumnConfig<TData> => ({
            id: 'gallery',
            header: 'Gallery',
            accessorKey,
            enableSorting: false,
            columnType: ColumnType.GALLERY,
            startVisibleOnTable: false,
            startVisibleOnGrid: true
        }),

        /**
         * Returns common columns that most entities have
         * Includes: isFeatured, visibility, lifecycleState, moderationState, createdAt
         */
        commonColumns: (): readonly ColumnConfig<TData>[] => [
            {
                id: 'isFeatured',
                header: 'Featured',
                accessorKey: 'isFeatured',
                enableSorting: true,
                columnType: ColumnType.BOOLEAN
            },
            {
                id: 'visibility',
                header: 'Visibility',
                accessorKey: 'visibility',
                enableSorting: true,
                columnType: ColumnType.BADGE,
                badgeOptions: VISIBILITY_BADGE_OPTIONS
            },
            {
                id: 'lifecycleState',
                header: 'Status',
                accessorKey: 'lifecycleState',
                enableSorting: true,
                columnType: ColumnType.BADGE,
                badgeOptions: LIFECYCLE_STATE_BADGE_OPTIONS,
                startVisibleOnTable: false,
                startVisibleOnGrid: true
            },
            {
                id: 'moderationState',
                header: 'Moderation',
                accessorKey: 'moderationState',
                enableSorting: true,
                columnType: ColumnType.BADGE,
                badgeOptions: MODERATION_STATE_BADGE_OPTIONS,
                startVisibleOnTable: false,
                startVisibleOnGrid: false
            },
            {
                id: 'createdAt',
                header: 'Created',
                accessorKey: 'createdAt',
                enableSorting: true,
                columnType: ColumnType.TIME_AGO
            }
        ],

        /**
         * Returns rating-related columns
         * Includes: averageRating, reviewsCount
         */
        ratingColumns: (): readonly ColumnConfig<TData>[] => [
            {
                id: 'averageRating',
                header: 'Rating',
                accessorKey: 'averageRating',
                enableSorting: true,
                columnType: ColumnType.NUMBER
            },
            {
                id: 'reviewsCount',
                header: 'Reviews',
                accessorKey: 'reviewsCount',
                enableSorting: true,
                columnType: ColumnType.NUMBER
            }
        ],

        /**
         * Returns media-related columns
         * Includes: featuredImage, gallery
         */
        mediaColumns: (
            featuredImageKey = 'media.featuredImage',
            galleryKey = 'media.gallery'
        ): readonly ColumnConfig<TData>[] => [
            {
                id: 'featuredImage',
                header: 'Featured Image',
                accessorKey: featuredImageKey,
                enableSorting: false,
                columnType: ColumnType.IMAGE,
                startVisibleOnTable: false,
                startVisibleOnGrid: true
            },
            {
                id: 'gallery',
                header: 'Gallery',
                accessorKey: galleryKey,
                enableSorting: false,
                columnType: ColumnType.GALLERY,
                startVisibleOnTable: false,
                startVisibleOnGrid: true
            }
        ],

        /**
         * Creates a custom column with full configuration
         */
        custom: (columnConfig: ColumnConfig<TData>): ColumnConfig<TData> => columnConfig
    };
};

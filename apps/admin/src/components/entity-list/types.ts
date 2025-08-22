import type {
    BadgeOption,
    ColumnType,
    CompoundOption,
    EntityOption,
    EntityType,
    ListOrientation,
    WidgetRenderer
} from '@/components/table/DataTable';
import type { ReactNode } from 'react';
import type { z } from 'zod';

/**
 * Configuration for search functionality
 */
export type SearchConfig = {
    readonly minChars: number;
    readonly debounceMs: number;
    readonly placeholder?: string;
    readonly enabled?: boolean;
};

/**
 * Configuration for view settings (table/grid)
 */
export type ViewConfig = {
    readonly defaultView: 'table' | 'grid';
    readonly allowViewToggle: boolean;
    readonly gridConfig?: {
        readonly maxFields: number;
        readonly columns: {
            readonly mobile: number;
            readonly tablet: number;
            readonly desktop: number;
        };
    };
};

/**
 * Configuration for pagination
 */
export type PaginationConfig = {
    readonly defaultPageSize: number;
    readonly allowedPageSizes: readonly number[];
};

/**
 * Configuration for layout and UI
 */
export type LayoutConfig = {
    readonly title: string;
    readonly showBreadcrumbs?: boolean;
    readonly showCreateButton?: boolean;
    readonly createButtonText?: string;
    readonly createButtonPath?: string;
};

/**
 * Link handler configuration for navigation
 */
export type LinkHandler<TData = unknown> = (row: TData) =>
    | {
          readonly to: string;
          readonly params?: Record<string, string | number>;
          readonly search?: Record<string, unknown>;
      }
    | undefined;

/**
 * Column configuration for entity lists
 */
export type ColumnConfig<TData = unknown> = {
    readonly id: string;
    readonly header: string;
    readonly accessorKey: string;
    readonly enableSorting: boolean;
    readonly startVisibleOnTable?: boolean;
    readonly startVisibleOnGrid?: boolean;
    readonly columnType?: ColumnType;
    readonly badgeOptions?: readonly BadgeOption[];
    readonly linkHandler?: LinkHandler<TData>;
    readonly entityOptions?: EntityOption;
    readonly listSeparator?: string;
    readonly listOrientation?: ListOrientation;
    readonly widgetRenderer?: WidgetRenderer<TData>;
    readonly compoundOptions?: CompoundOption;
};

/**
 * Helper type to map column types to TypeScript types
 */
export type ColumnTypeToTSType<T extends ColumnConfig['columnType']> = T extends ColumnType.STRING
    ? string
    : T extends ColumnType.NUMBER
      ? number
      : T extends ColumnType.DATE
        ? string
        : T extends ColumnType.TIME_AGO
          ? string
          : T extends ColumnType.BOOLEAN
            ? boolean
            : T extends ColumnType.BADGE
              ? string
              : T extends ColumnType.LINK
                ? string
                : T extends ColumnType.ENTITY
                  ? string
                  : T extends ColumnType.LIST
                    ? string[]
                    : T extends ColumnType.WIDGET
                      ? unknown
                      : T extends ColumnType.PRICE
                        ? object
                        : T extends ColumnType.COMPOUND
                          ? unknown
                          : T extends ColumnType.IMAGE
                            ? string | object
                            : T extends ColumnType.GALLERY
                              ? Array<string | object>
                              : unknown;

/**
 * Helper type to generate Row type from columns config
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic type constraint compatibility
export type GenerateRowType<T extends readonly ColumnConfig<any>[]> = {
    [K in T[number] as K['accessorKey']]?: ColumnTypeToTSType<K['columnType']>;
} & {
    readonly id: string;
    readonly [key: string]: unknown;
};

/**
 * Sort configuration
 */
export type SortConfig = {
    readonly id: string;
    readonly desc: boolean;
};

/**
 * API query parameters
 */
export type EntityQueryParams = {
    readonly page: number;
    readonly pageSize: number;
    readonly q?: string;
    readonly sort?: readonly SortConfig[];
};

/**
 * API response structure
 */
export type EntityQueryResponse<TData> = {
    readonly data: readonly TData[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
};

/**
 * Main entity configuration
 */
export type EntityConfig<TData = unknown> = {
    // Metadata
    readonly name: string;
    readonly displayName: string;
    readonly pluralDisplayName: string;
    readonly entityType: EntityType;

    // API
    readonly apiEndpoint: string;

    // Routes
    readonly basePath: string;
    readonly detailPath?: string;

    // Schemas
    readonly listItemSchema: z.ZodSchema<TData>;

    // Configuration
    readonly searchConfig?: SearchConfig;
    readonly viewConfig?: ViewConfig;
    readonly paginationConfig?: PaginationConfig;
    readonly layoutConfig: LayoutConfig;

    // Columns
    readonly createColumns: () => readonly ColumnConfig<TData>[];
};

/**
 * Generated entity list components
 */
export type EntityListComponents = {
    readonly component: () => ReactNode;
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
    readonly route: any;
};

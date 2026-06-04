import type {
    BadgeOption,
    ColumnType,
    CompoundOption,
    EntityOption,
    EntityType,
    ListOrientation,
    WidgetRenderer
} from '@/components/table/DataTable';
import type { TranslationKey } from '@repo/i18n';
import type { ComponentType, ReactNode } from 'react';
import type { z } from 'zod';
import type { FilterBarConfig } from './filters/filter-types';

/**
 * Translation function signature compatible with `useTranslations().t`.
 * Used by column factories to resolve headers and badge labels via i18n keys.
 */
export type ColumnTFunction = (key: TranslationKey, params?: Record<string, unknown>) => string;

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
 * Props passed to a per-entity custom grid card renderer.
 *
 * A config can supply `gridConfig.renderCard` to replace the polished generic
 * `GridCard` for its entity. The custom renderer receives the row data and the
 * three standard action callbacks so it has full parity with the generic card.
 *
 * @typeParam TData - The entity row type.
 */
export interface GridCardRenderProps<TData> {
    /** The entity row being rendered. */
    readonly row: TData;
    /** Open the peek drawer for this row. */
    readonly onPeek: (row: TData) => void;
    /** Navigate to the edit page for this row. */
    readonly onEdit: (row: TData) => void;
    /** Trigger the delete action for this row. */
    readonly onDelete: (row: TData) => void;
}

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
        /**
         * Per-entity custom card renderer (opt-in, backward-compatible).
         *
         * When present, the grid renderer calls this function instead of the
         * polished generic `GridCard` for every row. The function receives
         * `GridCardRenderProps<TData>` which exposes the row data plus the
         * three standard action callbacks (peek / edit / delete), ensuring full
         * parity with the generic card.
         *
         * When absent (the default), the generic `GridCard` is used — all
         * existing configs that do not set this field are unaffected.
         */
        readonly renderCard?: (props: GridCardRenderProps<unknown>) => ReactNode;
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
    /**
     * @deprecated Use entityKey for i18n support. Title will be computed from translations.
     */
    readonly title?: string;
    readonly showBreadcrumbs?: boolean;
    readonly showCreateButton?: boolean;
    /**
     * @deprecated Use entityKey for i18n support. Button text will be computed from translations.
     */
    readonly createButtonText?: string;
    readonly createButtonPath?: string;
    /**
     * SPEC-182: optional component rendered in the list header, before the
     * standard create button. Used for entity-specific header actions such as
     * the "Create host account" modal trigger on the users list. Opt-in — when
     * unset, the header renders exactly as before (create button only).
     */
    readonly headerActionsComponent?: ComponentType;
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
 * Configuration for a single field shown in the peek drawer.
 *
 * When `peekFields` is set on `EntityConfig`, the drawer renders exactly these
 * fields instead of the generic column list. Each entry maps an accessor path
 * (supports dot-notation, e.g. `"destination.name"`) to a translated label key
 * and an optional display format.
 */
export type PeekFieldConfig = {
    /** Dot-notation accessor path on the row object (e.g. `"name"`, `"price.price"`). */
    readonly accessorKey: string;
    /** Translation key for the field label (passed through `t()`). */
    readonly labelKey: string;
    /**
     * How to render the value:
     * - `'text'` / omitted — String coercion (default inference behaviour).
     * - `'boolean'` — renders as Sí/No.
     * - `'date'` — formats an ISO string or Date as a short localised date.
     * - `'list'` — comma-joins an array value.
     * - `'badge'` — renders a colored badge using `badgeOptions` to map the raw value.
     * - `'image'` — resolves the accessor to a URL and renders a preview image.
     * - `'address'` — assembles a human-readable address from the `location` object.
     */
    readonly format?: 'text' | 'boolean' | 'date' | 'list' | 'badge' | 'image' | 'address';
    /**
     * Maximum length for text truncation (only applies when `format` is `'text'`
     * or omitted). When set, values longer than this are truncated with `…`.
     */
    readonly maxLength?: number;
    /**
     * Badge options used when `format === 'badge'`. Maps raw enum values to
     * human-readable labels + colors. When absent, the raw value is displayed
     * as plain text inside a default badge shell.
     *
     * Prefer leaving this empty in the config and letting `EntityListPage` look
     * up the matching column's `badgeOptions` automatically (avoids duplication).
     */
    readonly badgeOptions?: readonly BadgeOption[];
};

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
    /** Horizontal alignment of the column header and cells. Defaults to left. */
    readonly align?: 'left' | 'right' | 'center';
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
    readonly filters?: Readonly<Record<string, string | number | boolean | undefined>>;
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
    /**
     * Translation key for this entity (e.g., 'accommodation', 'destination')
     * Used to look up translations in admin-entities namespace
     */
    readonly entityKey: string;
    /**
     * @deprecated Use entityKey for i18n support. Kept for backwards compatibility.
     */
    readonly displayName?: string;
    /**
     * @deprecated Use entityKey for i18n support. Kept for backwards compatibility.
     */
    readonly pluralDisplayName?: string;
    readonly entityType: EntityType;

    // API
    readonly apiEndpoint: string;
    /** Default query parameters to always include in API requests (LEGACY - prefer filterBarConfig.filters[].defaultValue) */
    readonly defaultFilters?: Readonly<Record<string, string>>;
    /** Filter bar configuration. If undefined, no filter bar is shown. When defined, defaultFilters is ignored. */
    readonly filterBarConfig?: FilterBarConfig;

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
    /**
     * Default sort applied when the URL carries no explicit sort.
     * It is sent to the API (so data and header agree) and rendered as the
     * active sort indicator on the matching column header.
     */
    readonly defaultSort?: SortConfig;

    // Columns
    readonly createColumns: (t: ColumnTFunction) => readonly ColumnConfig<TData>[];

    /**
     * Curated list of fields to display in the peek drawer.
     *
     * When provided, the drawer renders only these fields (in order) instead of
     * the generic column list derived from `createColumns`. Omit to keep the
     * default fallback behaviour (all visible columns).
     */
    readonly peekFields?: ReadonlyArray<PeekFieldConfig>;

    /**
     * Accessor for a value shown as the peek drawer subtitle (under the title),
     * e.g. the entity slug. Resolved against the row; dot-notation supported.
     */
    readonly peekSubtitleField?: string;

    /**
     * Accessor for a boolean field shown as a "featured" chip next to the peek
     * drawer title when truthy (e.g. `isFeatured`).
     */
    readonly peekFeaturedField?: string;
};

/**
 * Generated entity list components
 */
export type EntityListComponents = {
    readonly component: () => ReactNode;
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
    readonly route: any;
};

/**
 * Search params type for entity list pages.
 * Index signature allows dynamic filter params (e.g., status, destinationType)
 * to coexist with known pagination/view params.
 */
export type EntityListSearchParams = {
    page?: number;
    pageSize?: number;
    q?: string;
    sort?: string;
    view?: 'table' | 'grid';
    cols?: string;
    /** Dynamic filter params from filterBarConfig */
    [filterParamKey: string]: string | number | boolean | undefined;
};

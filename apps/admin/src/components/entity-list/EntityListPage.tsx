import { GridCard, GridEmptyState } from '@/components/grid';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import type { DataTableColumn, DataTableSort } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { DataTableToolbar } from '@/components/table/DataTableToolbar';
import { TableSearchInput } from '@/components/table/TableSearchInput';
import { Button } from '@/components/ui-wrapped/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import type { TranslationKey } from '@repo/i18n';
import { AddIcon } from '@repo/icons';
import type { NavigateOptions, RegisteredRouter } from '@tanstack/react-router';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EntitySummarySheet, type SummaryColumn } from './EntitySummarySheet';
import { createEntityApi } from './api/createEntityApi';
import { FilterBar } from './filters/FilterBar';
import { useFilterState } from './filters/useFilterState';
import { useEntityQuery } from './hooks/useEntityQuery';
import type {
    EntityConfig,
    EntityListComponents,
    EntityListSearchParams,
    GenerateRowType,
    SortConfig
} from './types';

/**
 * Type helper for dynamic navigation options.
 * TanStack Router requires literal route types, but factory patterns need dynamic routes.
 */
type DynamicNavigateOptions = NavigateOptions<RegisteredRouter, string, string>;

/**
 * Default configurations
 */
const DEFAULT_SEARCH_CONFIG = {
    minChars: 5,
    debounceMs: 500,
    // placeholder is computed dynamically using translations
    enabled: true
} as const;

const DEFAULT_VIEW_CONFIG = {
    defaultView: 'table' as const,
    allowViewToggle: true,
    gridConfig: {
        maxFields: 10,
        columns: {
            mobile: 1,
            tablet: 2,
            desktop: 3
        }
    }
} as const;

const DEFAULT_PAGINATION_CONFIG = {
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50] as const
} as const;

/**
 * Fallback sort applied to any list whose config does not set `defaultSort`.
 * Every entity table exposes a sortable `createdAt` column, so newest-first
 * is the sensible shared default. A config can override it per entity.
 */
const DEFAULT_SORT_CONFIG: SortConfig = { id: 'createdAt', desc: true };

/**
 * Static Tailwind grid column class map.
 * Dynamic class construction (e.g. \`grid-cols-${n}\`) does not work because
 * Tailwind purges classes it cannot find in source at build time.
 */
const gridColsMap: Readonly<Record<number, string>> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
} as const;

/**
 * Returns static Tailwind grid-cols classes for mobile, tablet, and desktop breakpoints.
 */
const getGridColsClass = ({
    mobile,
    tablet,
    desktop
}: {
    readonly mobile: number;
    readonly tablet: number;
    readonly desktop: number;
}): string => {
    const mobileClass = gridColsMap[mobile] ?? 'grid-cols-1';
    const tabletClass = gridColsMap[tablet] ?? 'grid-cols-2';
    const desktopClass = gridColsMap[desktop] ?? 'grid-cols-3';
    return `${mobileClass} md:${tabletClass} lg:${desktopClass}`;
};

/**
 * Creates a complete entity list page with all functionality
 */
export const createEntityListPage = <TData extends { id: string }>(
    config: EntityConfig<TData>
): EntityListComponents => {
    // Merge with defaults
    const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config.searchConfig };
    const viewConfig = { ...DEFAULT_VIEW_CONFIG, ...config.viewConfig };
    const paginationConfig = { ...DEFAULT_PAGINATION_CONFIG, ...config.paginationConfig };

    // Create API client
    const api = createEntityApi({
        endpoint: config.apiEndpoint,
        itemSchema: config.listItemSchema,
        defaultFilters: config.defaultFilters,
        filterBarConfig: config.filterBarConfig
    });

    // Generate row type from columns
    type Row = GenerateRowType<ReturnType<typeof config.createColumns>> & TData;

    /**
     * Route validation schema
     */
    const validateSearch = (search: Record<string, unknown>) => {
        const num = (v: unknown, d: number) => {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n : d;
        };

        const page = num(search.page, 1);
        const pageSize = paginationConfig.allowedPageSizes.includes(Number(search.pageSize))
            ? Number(search.pageSize)
            : paginationConfig.defaultPageSize;
        const view = search.view === 'grid' ? 'grid' : 'table';
        const q = typeof search.q === 'string' ? search.q : '';
        const sort = typeof search.sort === 'string' ? search.sort : undefined;
        const cols = typeof search.cols === 'string' ? search.cols : undefined;

        // Pass through remaining params for filter state (extracted by useFilterState)
        const {
            page: _p,
            pageSize: _ps,
            view: _v,
            q: _q,
            sort: _s,
            cols: _c,
            ...rawFilterParams
        } = search;

        // Sanitize filter params to strings only (defend against crafted URLs like ?status[]=foo)
        const filterParams: Record<string, string> = {};
        for (const [key, value] of Object.entries(rawFilterParams)) {
            if (typeof value === 'string') {
                filterParams[key] = value;
            }
        }

        return { page, pageSize, view, q, sort, cols, ...filterParams };
    };

    /**
     * Main component
     */
    const EntityListPageComponent = () => {
        const { t } = useTranslations();
        const navigate = useNavigate();
        const search = Route.useSearch();

        // Compute translated entity names
        const entityPlural = useMemo(
            () =>
                t(`admin-entities.entities.${config.entityKey}.plural` as TranslationKey) ||
                config.pluralDisplayName ||
                config.name,
            [t, config.entityKey, config.pluralDisplayName, config.name]
        );

        // Compute translated UI strings
        const translatedTitle = useMemo(
            () =>
                config.layoutConfig?.title ||
                t('admin-entities.list.title' as TranslationKey, { entities: entityPlural }),
            [t, entityPlural, config.layoutConfig?.title]
        );
        const translatedSearchPlaceholder = useMemo(
            () =>
                searchConfig.placeholder ||
                t('admin-entities.list.searchPlaceholder' as TranslationKey, {
                    entities: entityPlural.toLowerCase()
                }),
            [t, entityPlural]
        );

        // Local state for debounced search
        const [localQuery, setLocalQuery] = useState(search.q || '');
        const [isSearching, setIsSearching] = useState(false);

        // Debounce effect for search
        useEffect(() => {
            const willTriggerSearch =
                localQuery !== search.q &&
                (localQuery.length === 0 ||
                    localQuery.length >= searchConfig.minChars ||
                    (localQuery.length < searchConfig.minChars && search.q !== ''));

            if (willTriggerSearch) {
                setIsSearching(true);
            }

            const timer = setTimeout(() => {
                let queryToSend: string;

                if (localQuery.length === 0) {
                    queryToSend = '';
                } else if (localQuery.length >= searchConfig.minChars) {
                    queryToSend = localQuery;
                } else {
                    queryToSend = '';
                }

                if (queryToSend !== search.q) {
                    navigate({
                        search: (prev: EntityListSearchParams) => ({
                            ...prev,
                            q: queryToSend,
                            page: 1
                        })
                    } as DynamicNavigateOptions);
                }

                setIsSearching(false);
            }, searchConfig.debounceMs);

            return () => {
                clearTimeout(timer);
                setIsSearching(false);
            };
        }, [localQuery, search.q, navigate]);

        // Update local query when URL changes
        useEffect(() => {
            setLocalQuery(search.q || '');
        }, [search.q]);

        // Parse sort from URL ("field:direction" format)
        const parsedSort: DataTableSort = useMemo(() => {
            if (!search.sort) return [config.defaultSort ?? DEFAULT_SORT_CONFIG];
            try {
                const parts = search.sort.split(':');
                if (parts.length === 2 && parts[0]) {
                    return [{ id: parts[0], desc: parts[1] === 'desc' }];
                }
                return [];
            } catch {
                return [];
            }
        }, [search.sort, config.defaultSort]);

        // updateSearch must be defined before useFilterState (which stores it in callbacks)
        const updateSearch = useCallback(
            (updater: (prev: EntityListSearchParams) => EntityListSearchParams) => {
                navigate({ search: updater } as DynamicNavigateOptions);
            },
            [navigate]
        );

        // Filter state management
        const filterState = useFilterState({
            filterBarConfig: config.filterBarConfig,
            searchParams: search as Record<string, unknown>,
            onUpdateSearch: updateSearch as (
                updater: (prev: Record<string, unknown>) => Record<string, unknown>
            ) => void
        });

        // Query data
        const { data, isLoading, error } = useEntityQuery(config.name, api.getEntities, {
            page: search.page,
            pageSize: search.pageSize,
            q: search.q,
            sort: parsedSort,
            filters: filterState.activeFilters
        });

        // Handle errors
        const { addToast } = useToast();
        useEffect(() => {
            if (error) {
                addToast({
                    title: t('admin-entities.messages.error.load' as TranslationKey, {
                        entity: entityPlural
                    }),
                    message: error.message ?? 'Unknown error',
                    variant: 'error'
                });
                adminLogger.error(`Failed to load ${config.name}`, error);
            }
        }, [error, addToast, config.name, entityPlural, t]);

        const rows: Row[] = (data?.data ?? []) as Row[];
        const total = data?.total ?? 0;

        // Peek drawer state: holds the row whose own-entity link was clicked in table view
        const [peekRow, setPeekRow] = useState<Row | null>(null);

        /**
         * Ref that always holds the current view mode.
         * Using a ref here lets the column linkHandlers read the current view at call-time
         * without needing to include `search.view` in the useMemo dependency array,
         * which would re-build the entire columns array on every view toggle.
         */
        const viewRef = useRef(search.view);
        viewRef.current = search.view;

        // Generate columns
        const columns = useMemo<readonly DataTableColumn<Row>[]>(() => {
            const columnsConfig = config.createColumns(t);
            return columnsConfig.map((columnConfig) => ({
                ...columnConfig,
                accessorKey: columnConfig.accessorKey as keyof Row & string,
                startVisibleOnTable: columnConfig.startVisibleOnTable,
                startVisibleOnGrid: columnConfig.startVisibleOnGrid,
                linkHandler: columnConfig.linkHandler
                    ? (row: Row) => {
                          const result = columnConfig.linkHandler?.(row);
                          if (!result) return;
                          // Own-entity link in table view → open the peek drawer instead of navigating.
                          // viewRef.current is read at call-time so the check is always fresh.
                          // The link must point to THIS row's own detail page: a basePath
                          // prefix match alone is not enough, because related-entity columns
                          // (e.g. event organizer/location live under the same /events subtree)
                          // would falsely match — so also require the target id to be the row's.
                          const linkParams = result.params as { id?: unknown } | undefined;
                          const isOwnEntity =
                              typeof result.to === 'string' &&
                              result.to.startsWith(config.basePath) &&
                              linkParams?.id === row.id;
                          if (isOwnEntity && viewRef.current === 'table') {
                              setPeekRow(row);
                              return;
                          }
                          navigate(result);
                      }
                    : undefined
            }));
        }, [navigate, config.createColumns, config.basePath, t]);

        // Column visibility logic
        const getInitialColumnVisibility = useCallback(
            (viewType: 'table' | 'grid') => {
                const visibility: Record<string, boolean> = {};
                for (const columnConfig of config.createColumns(t)) {
                    if (viewType === 'table') {
                        visibility[columnConfig.id] = columnConfig.startVisibleOnTable !== false;
                    } else {
                        visibility[columnConfig.id] = columnConfig.startVisibleOnGrid !== false;
                    }
                }
                return visibility;
            },
            [config.createColumns, t]
        );

        const initialColumnVisibility = useMemo(() => {
            return getInitialColumnVisibility('table');
        }, [getInitialColumnVisibility]);

        const [columnVisibility, setColumnVisibility] =
            useState<Record<string, boolean>>(initialColumnVisibility);

        const currentViewVisibility = useMemo(() => {
            if (search.view === 'grid') {
                return getInitialColumnVisibility('grid');
            }
            return columnVisibility;
        }, [search.view, getInitialColumnVisibility, columnVisibility]);

        const availableColumns = useMemo(
            () => columns.map((c) => ({ id: c.id, label: String(c.header) })),
            [columns]
        );

        /**
         * Columns shaped for EntitySummarySheet.
         *
         * When `config.peekFields` is defined we use the curated list — each entry
         * maps directly to a `SummaryColumn` with an explicit `format` hint.
         * For badge fields, `badgeOptions` are resolved from the matching column
         * definition (avoiding duplication in the config). If no matching column
         * is found, any `badgeOptions` declared on the peek field itself are used.
         * Otherwise we fall back to deriving the list from all `columns` (generic
         * behaviour for entities that haven't declared peekFields yet).
         */
        const summaryColumns = useMemo<readonly SummaryColumn[]>(
            () => {
                if (config.peekFields) {
                    return config.peekFields.map((pf) => {
                        // For badge fields, look up the matching column to reuse its badgeOptions
                        const matchingColumn =
                            pf.format === 'badge'
                                ? columns.find(
                                      (c) =>
                                          c.accessorKey === pf.accessorKey ||
                                          c.id === pf.accessorKey
                                  )
                                : undefined;
                        const badgeOptions = matchingColumn?.badgeOptions ?? pf.badgeOptions;

                        return {
                            id: pf.accessorKey,
                            header: t(pf.labelKey as TranslationKey),
                            accessorKey: pf.accessorKey,
                            format: pf.format,
                            maxLength: pf.maxLength,
                            badgeOptions
                        };
                    });
                }
                return columns.map((c) => ({
                    id: c.id,
                    header: String(c.header),
                    accessorKey: c.accessorKey as string
                }));
            },
            // biome-ignore lint/correctness/useExhaustiveDependencies: config.peekFields is stable (config object is defined at module level)
            [columns, config.peekFields, t]
        );

        /** Navigate to the full view page of the current peek row. */
        const handlePeekViewFull = useCallback(() => {
            if (!peekRow) return;
            navigate({
                to: `${config.basePath}/$id`,
                params: { id: peekRow.id }
            } as DynamicNavigateOptions);
            setPeekRow(null);
        }, [peekRow, navigate, config.basePath]);

        /** Navigate to the edit page of the current peek row. */
        const handlePeekEdit = useCallback(() => {
            if (!peekRow) return;
            navigate({
                to: `${config.basePath}/$id/edit`,
                params: { id: peekRow.id }
            } as DynamicNavigateOptions);
            setPeekRow(null);
        }, [peekRow, navigate, config.basePath]);

        // Handlers
        const handleViewChange = useCallback(
            (next: 'table' | 'grid') => updateSearch((prev) => ({ ...prev, view: next })),
            [updateSearch]
        );

        const handleQueryChange = useCallback((q: string) => setLocalQuery(q), []);

        const handleClearSearch = useCallback(() => {
            setLocalQuery('');
        }, []);

        const handlePageChange = useCallback(
            (p: number) => updateSearch((prev) => ({ ...prev, page: p })),
            [updateSearch]
        );

        const handlePageSizeChange = useCallback(
            (n: number) => updateSearch((prev) => ({ ...prev, pageSize: n, page: 1 })),
            [updateSearch]
        );

        const handleSortChange = useCallback(
            (s: DataTableSort) =>
                updateSearch((prev) => ({
                    ...prev,
                    sort: s.length > 0 ? `${s[0].id}:${s[0].desc ? 'desc' : 'asc'}` : undefined
                })),
            [updateSearch]
        );

        const handleColsChange = useCallback((v: Record<string, boolean>) => {
            setColumnVisibility(v);
        }, []);

        const getGridVisibleColumns = useCallback((): string[] => {
            return Object.keys(getInitialColumnVisibility('grid')).filter(
                (key) => getInitialColumnVisibility('grid')[key]
            );
        }, [getInitialColumnVisibility]);

        const createButtonAction = useMemo(() => {
            if (!config.layoutConfig?.showCreateButton || !config.layoutConfig?.createButtonPath) {
                return undefined;
            }
            const entitySingular =
                t(`admin-entities.entities.${config.entityKey}.singular` as TranslationKey) ||
                config.name;
            const buttonText =
                config.layoutConfig.createButtonText ||
                t('admin-entities.list.createButton' as TranslationKey, { entity: entitySingular });
            const buttonPath = config.layoutConfig.createButtonPath;
            return (
                <Button
                    size="sm"
                    onClick={() =>
                        navigate({
                            to: buttonPath
                        } as DynamicNavigateOptions)
                    }
                >
                    <AddIcon className="mr-2 h-4 w-4" />
                    {buttonText}
                </Button>
            );
        }, [config.layoutConfig, config.entityKey, config.name, t, navigate]);

        const searchInput = searchConfig.enabled ? (
            <TableSearchInput
                key={`search-config-${searchConfig.minChars}`}
                query={localQuery}
                onQueryChange={handleQueryChange}
                isSearching={isSearching}
                onClearSearch={handleClearSearch}
                searchMinChars={searchConfig.minChars}
                searchPlaceholder={translatedSearchPlaceholder}
            />
        ) : null;

        // SPEC-182: opt-in entity-specific header actions (e.g. the users list's
        // "Create host account" modal). Rendered before the create button. When
        // unset, the header is unchanged (create button only).
        const HeaderActionsComponent = config.layoutConfig?.headerActionsComponent;
        const headerActions = HeaderActionsComponent ? (
            <div className="flex items-center gap-2">
                <HeaderActionsComponent />
                {createButtonAction}
            </div>
        ) : (
            createButtonAction
        );

        return (
            <SidebarPageLayout
                title={translatedTitle}
                actions={headerActions}
            >
                <div className="space-y-4">
                    <div className="space-y-3 rounded-md border bg-card p-4">
                        <DataTableToolbar
                            view={search.view}
                            onViewChange={viewConfig.allowViewToggle ? handleViewChange : () => {}}
                            columnVisibility={currentViewVisibility}
                            onColumnVisibilityChange={handleColsChange}
                            availableColumns={availableColumns}
                        />

                        {config.filterBarConfig ? (
                            <FilterBar
                                config={config.filterBarConfig}
                                activeFilters={filterState.activeFilters}
                                onFilterChange={filterState.handleFilterChange}
                                onClearAll={filterState.handleClearAll}
                                onResetDefaults={filterState.handleResetDefaults}
                                hasActiveFilters={filterState.hasActiveFilters}
                                hasNonDefaultFilters={filterState.hasNonDefaultFilters}
                                chips={filterState.chips}
                                searchSlot={searchInput}
                            />
                        ) : (
                            searchInput && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {searchInput}
                                </div>
                            )
                        )}
                    </div>

                    {search.view === 'table' ? (
                        <DataTable<Row>
                            columns={columns}
                            data={rows}
                            total={total}
                            rowId={(r) => r.id}
                            loading={isLoading}
                            page={search.page}
                            pageSize={search.pageSize}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
                            sort={parsedSort}
                            onSortChange={handleSortChange}
                            columnVisibility={currentViewVisibility}
                            onColumnVisibilityChange={handleColsChange}
                            highlightedRowId={peekRow?.id ?? undefined}
                        />
                    ) : (
                        <div
                            className={`grid gap-4 ${getGridColsClass({
                                mobile: viewConfig.gridConfig?.columns.mobile ?? 1,
                                tablet: viewConfig.gridConfig?.columns.tablet ?? 2,
                                desktop: viewConfig.gridConfig?.columns.desktop ?? 3
                            })}`}
                        >
                            {isLoading ? (
                                <div className="col-span-full text-muted-foreground text-sm">
                                    {t('ui.loading.text')}
                                </div>
                            ) : rows.length === 0 ? (
                                <GridEmptyState hasActiveFilters={filterState.hasActiveFilters} />
                            ) : (
                                rows.map((r) => {
                                    // Access renderCard from the original config (not the
                                    // DEFAULT_VIEW_CONFIG merge) to preserve its optional type.
                                    // TData is propagated through ViewConfig<TData> so no casts
                                    // are needed here — row is already typed as TData.
                                    const renderCard = config.viewConfig?.gridConfig?.renderCard;
                                    if (renderCard) {
                                        return renderCard({
                                            row: r,
                                            onPeek: (row) => setPeekRow(row as Row),
                                            onEdit: (row) =>
                                                navigate({
                                                    to: `${config.basePath}/$id/edit`,
                                                    params: { id: (row as Row).id }
                                                } as DynamicNavigateOptions),
                                            onDelete: (_row) => {
                                                // Delete is handled externally; no-op here unless
                                                // a future spec wires a delete handler into the config.
                                            }
                                        });
                                    }
                                    return (
                                        <GridCard<Row>
                                            key={r.id}
                                            item={r}
                                            columns={columns}
                                            visibleColumns={getGridVisibleColumns()}
                                            maxFields={viewConfig.gridConfig?.maxFields || 10}
                                            onPeek={(row) => setPeekRow(row)}
                                            onEdit={(row) =>
                                                navigate({
                                                    to: `${config.basePath}/$id/edit`,
                                                    params: { id: row.id }
                                                } as DynamicNavigateOptions)
                                            }
                                        />
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Peek drawer: shows a summary of the selected row in table view.
                    modal={false} → non-modal: no scroll-lock/focus-trap, overlay is
                    pointer-events-none, list remains interactive. Clicking another
                    entity name switches content instead of closing (handled via
                    onInteractOutside inside EntitySummarySheet). */}
                <EntitySummarySheet
                    open={peekRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setPeekRow(null);
                    }}
                    row={peekRow as Record<string, unknown> | null}
                    columns={summaryColumns}
                    title={
                        peekRow !== null && peekRow !== undefined
                            ? String(
                                  (peekRow as Record<string, unknown>).name ??
                                      (peekRow as Record<string, unknown>).title ??
                                      (peekRow as Record<string, unknown>).displayName ??
                                      (peekRow as Record<string, unknown>).id ??
                                      ''
                              )
                            : ''
                    }
                    subtitle={
                        config.peekSubtitleField && peekRow
                            ? String(
                                  (peekRow as Record<string, unknown>)[config.peekSubtitleField] ??
                                      ''
                              ) || undefined
                            : undefined
                    }
                    featured={
                        config.peekFeaturedField && peekRow
                            ? Boolean(
                                  (peekRow as Record<string, unknown>)[config.peekFeaturedField]
                              )
                            : false
                    }
                    featuredLabel={t('admin-entities.columns.featured' as TranslationKey)}
                    onViewFull={handlePeekViewFull}
                    onEdit={handlePeekEdit}
                    modal={false}
                />
            </SidebarPageLayout>
        );
    };

    // Create route
    // TanStack Router requires literal route types, but factory patterns need dynamic routes.
    // We use type assertion here because this is a generic factory component.
    // biome-ignore lint/suspicious/noExplicitAny: Factory pattern requires dynamic route paths
    const Route = createFileRoute(`${config.basePath}/` as any)({
        validateSearch,
        component: EntityListPageComponent
    });

    // NOTE: Data export feature not yet implemented

    return {
        component: EntityListPageComponent,
        route: Route
    };
};

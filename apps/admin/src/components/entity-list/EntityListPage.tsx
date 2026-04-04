import { GridCard } from '@/components/grid';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import type { DataTableColumn, DataTableSort } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { DataTableToolbar } from '@/components/table/DataTableToolbar';
import { Button } from '@/components/ui-wrapped/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import type { TranslationKey } from '@repo/i18n';
import { AddIcon } from '@repo/icons';
import type { NavigateOptions, RegisteredRouter } from '@tanstack/react-router';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createEntityApi } from './api/createEntityApi';
import { FilterBar } from './filters/FilterBar';
import { useFilterState } from './filters/useFilterState';
import { useEntityQuery } from './hooks/useEntityQuery';
import type { EntityConfig, EntityListComponents, GenerateRowType } from './types';

/**
 * Search params type for entity list pages
 */
interface EntityListSearchParams {
    page?: number;
    pageSize?: number;
    q?: string;
    sort?: string;
    view?: 'table' | 'grid';
}

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
            ...filterParams
        } = search;

        return { page, pageSize, view, q, sort, cols, ...filterParams } as const;
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
            if (!search.sort) return [];
            try {
                const parts = search.sort.split(':');
                if (parts.length === 2 && parts[0]) {
                    return [{ id: parts[0], desc: parts[1] === 'desc' }];
                }
                return [];
            } catch {
                return [];
            }
        }, [search.sort]);

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
            onUpdateSearch: updateSearch as unknown as (
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

        // Generate columns
        const columns = useMemo<readonly DataTableColumn<Row>[]>(() => {
            const columnsConfig = config.createColumns();
            return columnsConfig.map((columnConfig) => ({
                ...columnConfig,
                accessorKey: columnConfig.accessorKey as keyof Row & string,
                startVisibleOnTable: columnConfig.startVisibleOnTable,
                startVisibleOnGrid: columnConfig.startVisibleOnGrid,
                linkHandler: columnConfig.linkHandler
                    ? (row: Row) => {
                          const result = columnConfig.linkHandler?.(row);
                          if (result) {
                              navigate(result);
                          }
                      }
                    : undefined
            }));
        }, [navigate, config.createColumns]);

        // Column visibility logic
        const getInitialColumnVisibility = useCallback(
            (viewType: 'table' | 'grid') => {
                const visibility: Record<string, boolean> = {};
                for (const columnConfig of config.createColumns()) {
                    if (viewType === 'table') {
                        visibility[columnConfig.id] = columnConfig.startVisibleOnTable !== false;
                    } else {
                        visibility[columnConfig.id] = columnConfig.startVisibleOnGrid !== false;
                    }
                }
                return visibility;
            },
            [config.createColumns]
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
            const buttonText = config.layoutConfig.createButtonText || `Crear ${entitySingular}`;
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

        return (
            <SidebarPageLayout
                title={translatedTitle}
                actions={createButtonAction}
            >
                <div className="space-y-4">
                    <DataTableToolbar
                        key={`search-config-${searchConfig.minChars}`}
                        view={search.view}
                        onViewChange={viewConfig.allowViewToggle ? handleViewChange : () => {}}
                        query={localQuery}
                        onQueryChange={searchConfig.enabled ? handleQueryChange : () => {}}
                        isSearching={isSearching}
                        onClearSearch={handleClearSearch}
                        searchMinChars={searchConfig.minChars}
                        searchPlaceholder={translatedSearchPlaceholder}
                        columnVisibility={currentViewVisibility}
                        onColumnVisibilityChange={handleColsChange}
                        availableColumns={availableColumns}
                    />

                    {config.filterBarConfig && (
                        <FilterBar
                            config={config.filterBarConfig}
                            activeFilters={filterState.activeFilters}
                            computedDefaults={filterState.computedDefaults}
                            onFilterChange={filterState.handleFilterChange}
                            onClearAll={filterState.handleClearAll}
                            onResetDefaults={filterState.handleResetDefaults}
                            hasActiveFilters={filterState.hasActiveFilters}
                            hasNonDefaultFilters={filterState.hasNonDefaultFilters}
                            chips={filterState.chips}
                        />
                    )}

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
                                <div className="text-muted-foreground text-sm">
                                    {t('ui.loading.text')}
                                </div>
                            ) : rows.length === 0 ? (
                                <div className="text-muted-foreground text-sm">
                                    {t('admin-entities.list.noResults' as TranslationKey)}
                                </div>
                            ) : (
                                rows.map((r) => (
                                    <GridCard<Row>
                                        key={r.id}
                                        item={r}
                                        columns={columns}
                                        visibleColumns={getGridVisibleColumns()}
                                        maxFields={viewConfig.gridConfig?.maxFields || 10}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>
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

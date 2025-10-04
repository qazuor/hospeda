import { GridCard } from '@/components/grid';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import type { DataTableColumn, DataTableSort } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { DataTableToolbar } from '@/components/table/DataTableToolbar';
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createEntityApi } from './api/createEntityApi';
import { useEntityQuery } from './hooks/useEntityQuery';
import type { EntityConfig, EntityListComponents, GenerateRowType } from './types';

/**
 * Default configurations
 */
const DEFAULT_SEARCH_CONFIG = {
    minChars: 5,
    debounceMs: 500,
    placeholder: 'Search...',
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
    const api = createEntityApi(config.apiEndpoint, config.listItemSchema);

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

        return { page, pageSize, view, q, sort, cols } as const;
    };

    /**
     * Main component
     */
    const EntityListPageComponent = () => {
        const { t } = useTranslations();
        const navigate = useNavigate();
        const search = Route.useSearch();

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
                        // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
                        search: (prev: any) => ({ ...prev, q: queryToSend, page: 1 })
                        // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
                    } as any);
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

        // Parse sort from URL
        const parsedSort: DataTableSort = useMemo(() => {
            if (!search.sort) return [];
            try {
                const s = JSON.parse(search.sort) as DataTableSort;
                return Array.isArray(s) ? s : [];
            } catch {
                return [];
            }
        }, [search.sort]);

        // Query data
        const { data, isLoading, error } = useEntityQuery(config.name, api.getEntities, {
            page: search.page,
            pageSize: search.pageSize,
            q: search.q,
            sort: parsedSort
        });

        // Handle errors
        const { addToast } = useToast();
        useEffect(() => {
            if (error) {
                addToast({
                    title: `Failed to load ${config.pluralDisplayName.toLowerCase()}`,
                    message: error.message ?? 'Unknown error',
                    variant: 'error'
                });
                adminLogger.error(error, `Failed to load ${config.name}`);
            }
        }, [error, addToast, config.name, config.pluralDisplayName]);

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
        const updateSearch = useCallback(
            // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
            (updater: (prev: any) => any) => {
                // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
                navigate({ search: updater } as any);
            },
            [navigate]
        );

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
            (s: DataTableSort) => updateSearch((prev) => ({ ...prev, sort: JSON.stringify(s) })),
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

        return (
            <SidebarPageLayout title={config.layoutConfig.title}>
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
                        columnVisibility={currentViewVisibility}
                        onColumnVisibilityChange={handleColsChange}
                        availableColumns={availableColumns}
                    />

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
                            className={`grid grid-cols-${viewConfig.gridConfig?.columns.mobile || 1} gap-4 md:grid-cols-${viewConfig.gridConfig?.columns.tablet || 2}lg:grid-cols-${viewConfig.gridConfig?.columns.desktop || 3}`}
                        >
                            {isLoading ? (
                                <div className="text-muted-foreground text-sm">
                                    {t('ui.loading.text')}
                                </div>
                            ) : rows.length === 0 ? (
                                <div className="text-muted-foreground text-sm">
                                    No records found
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
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
    const Route = createFileRoute(`${config.basePath}/` as any)({
        validateSearch,
        component: EntityListPageComponent
    });

    // TODO [41b0ad1e-a61e-4423-ae76-0926776a0486]: Add pagination controls to improve performance

    // TODO [2ea96e97-d954-423e-baaf-26f4835b07fd]: Implement user authentication for admin access #security
    // TODO [caee4e95-8862-4d21-8cb5-99a86bf67d70]: Add data export functionality for reports #feature
    // TODO [9517e749-bda9-48bc-8c96-ae8addb39943]: Implement enhanced role-based permissions #security

    return {
        component: EntityListPageComponent,
        route: Route
    };
};

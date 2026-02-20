import { EmptyState } from '@/components/feedback/EmptyState';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import {
    type ColumnDef,
    type SortingState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable
} from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import { type DataTableColumn, type DataTableSort, renderCellByType } from './DataTable';
import {
    TABLE_VIRTUALIZATION_PRESETS,
    type VirtualizedTableConfig,
    useVirtualizedTable
} from './hooks/useVirtualizedTable';

export type VirtualizedDataTableProps<TData> = {
    readonly columns: ReadonlyArray<DataTableColumn<TData>>;
    readonly data: ReadonlyArray<TData>;
    readonly total: number;
    readonly rowId: (row: TData) => string;
    readonly loading?: boolean;

    readonly page: number;
    readonly pageSize: number;
    readonly onPageChange: (page: number) => void;
    readonly onPageSizeChange: (pageSize: number) => void;

    readonly sort: DataTableSort;
    readonly onSortChange: (sort: DataTableSort) => void;

    readonly columnVisibility: Record<string, boolean>;
    readonly onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;

    /** Virtualization configuration */
    readonly virtualizationConfig?: VirtualizedTableConfig;
    /** Enable/disable virtualization (auto-enabled for 30+ rows) */
    readonly enableVirtualization?: boolean;
    /** Show virtualization debug info in development */
    readonly showVirtualizationDebug?: boolean;
};

/**
 * Virtualized DataTable component for large datasets
 *
 * Uses TanStack Virtual to efficiently render only visible rows,
 * significantly improving performance for tables with many rows.
 *
 * @example
 * ```tsx
 * <VirtualizedDataTable
 *   columns={columns}
 *   data={data}
 *   total={total}
 *   rowId={(row) => row.id}
 *   page={page}
 *   pageSize={100}
 *   onPageChange={setPage}
 *   onPageSizeChange={setPageSize}
 *   sort={sort}
 *   onSortChange={setSort}
 *   columnVisibility={columnVisibility}
 *   onColumnVisibilityChange={setColumnVisibility}
 *   virtualizationConfig={{
 *     estimateRowHeight: 48,
 *     overscan: 10,
 *     maxHeight: 600
 *   }}
 * />
 * ```
 */
export const VirtualizedDataTable = <TData,>({
    columns,
    data,
    total,
    rowId,
    loading = false,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    sort,
    onSortChange,
    columnVisibility,
    onColumnVisibilityChange,
    virtualizationConfig = TABLE_VIRTUALIZATION_PRESETS.standard,
    enableVirtualization = true,
    showVirtualizationDebug = false
}: VirtualizedDataTableProps<TData>) => {
    const { t } = useTranslations();

    const internalColumns: ColumnDef<TData>[] = useMemo(
        () =>
            columns.map((col) => ({
                id: col.id,
                accessorKey: col.accessorKey,
                header: () => col.header,
                cell: (info) => renderCellByType(col, info.getValue(), info.row.original),
                enableSorting: col.enableSorting ?? true,
                enableHiding: col.enableHiding ?? true
            })),
        [columns]
    );

    const sortingState: SortingState = useMemo(
        () =>
            sort.map((s) => ({
                id: s.id,
                desc: s.desc
            })),
        [sort]
    );

    const handleSortingChange = useCallback(
        (updater: SortingState | ((old: SortingState) => SortingState)) => {
            const next = typeof updater === 'function' ? updater(sortingState) : updater;
            onSortChange(next.map((s) => ({ id: s.id, desc: s.desc })));
        },
        [sortingState, onSortChange]
    );

    const handleColumnVisibilityChange = useCallback(
        (
            updater:
                | Record<string, boolean>
                | ((old: Record<string, boolean>) => Record<string, boolean>)
        ) => {
            const next = typeof updater === 'function' ? updater(columnVisibility) : updater;
            onColumnVisibilityChange(next as Record<string, boolean>);
        },
        [columnVisibility, onColumnVisibilityChange]
    );

    const memoizedData = useMemo(() => data as TData[], [data]);

    const table = useReactTable<TData>({
        data: memoizedData,
        columns: internalColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: handleSortingChange,
        state: {
            sorting: sortingState,
            columnVisibility
        },
        onColumnVisibilityChange: handleColumnVisibilityChange
    });

    const tableRows = table.getRowModel().rows;

    // Virtualization hook
    const {
        containerRef,
        virtualRows,
        totalSize,
        containerStyles,
        bodyWrapperStyles,
        getRowStyles,
        shouldVirtualize,
        getVisibleRange
    } = useVirtualizedTable({
        rows: tableRows,
        config: virtualizationConfig,
        getRowId: (row) => rowId(row.original)
    });

    const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

    // Determine if we should use virtualization
    const useVirtualRendering = enableVirtualization && shouldVirtualize;

    // Render table header
    const renderHeader = () => (
        <thead className="bg-muted text-muted-foreground">
            {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                    {hg.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        const sorting = header.column.getIsSorted();
                        return (
                            <th
                                key={header.id}
                                scope="col"
                                className="select-none px-3 py-2 font-medium"
                            >
                                {canSort ? (
                                    <button
                                        type="button"
                                        className={cn(
                                            'inline-flex items-center gap-1 underline-offset-4 hover:underline'
                                        )}
                                        onClick={header.column.getToggleSortingHandler()}
                                        aria-label={t('ui.accessibility.sortColumn')}
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                        <span className="text-xs">
                                            {sorting === 'asc'
                                                ? '▲'
                                                : sorting === 'desc'
                                                  ? '▼'
                                                  : ''}
                                        </span>
                                    </button>
                                ) : (
                                    flexRender(header.column.columnDef.header, header.getContext())
                                )}
                            </th>
                        );
                    })}
                </tr>
            ))}
        </thead>
    );

    // Render virtualized rows
    const renderVirtualizedBody = () => (
        <tbody style={bodyWrapperStyles}>
            {virtualRows.map((virtualRow) => {
                const row = tableRows[virtualRow.index];
                if (!row) return null;

                return (
                    <tr
                        key={rowId(row.original)}
                        className="border-t"
                        style={getRowStyles(virtualRow)}
                        data-index={virtualRow.index}
                    >
                        {row.getVisibleCells().map((cell) => (
                            <td
                                key={cell.id}
                                className="px-3 py-2"
                            >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                );
            })}
        </tbody>
    );

    // Render standard (non-virtualized) rows
    const renderStandardBody = () => (
        <tbody>
            {loading ? (
                <tr>
                    <td
                        className="px-3 py-4"
                        colSpan={columns.length}
                    >
                        {t('ui.loading.text')}
                    </td>
                </tr>
            ) : data.length === 0 ? (
                <tr>
                    <td
                        className="px-3 py-6"
                        colSpan={columns.length}
                    >
                        <EmptyState message={t('ui.errors.noRecordsFound')} />
                    </td>
                </tr>
            ) : (
                tableRows.map((row) => (
                    <tr
                        key={rowId(row.original)}
                        className="border-t"
                    >
                        {row.getVisibleCells().map((cell) => (
                            <td
                                key={cell.id}
                                className="px-3 py-2"
                            >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                ))
            )}
        </tbody>
    );

    return (
        <div className="space-y-3">
            {/* Virtualization debug info */}
            {showVirtualizationDebug && process.env.NODE_ENV === 'development' && (
                <div className="rounded border bg-blue-50 px-3 py-2 text-blue-800 text-xs">
                    <span className="font-medium">Virtualization:</span>{' '}
                    {useVirtualRendering ? 'Active' : 'Disabled'}
                    {useVirtualRendering && (
                        <>
                            {' '}
                            | Rows: {tableRows.length} | Rendered: {virtualRows.length} | Visible:{' '}
                            {getVisibleRange().start}-{getVisibleRange().end} | Total height:{' '}
                            {totalSize}px
                        </>
                    )}
                </div>
            )}

            {/* Table container */}
            {useVirtualRendering ? (
                <div
                    ref={containerRef}
                    style={containerStyles}
                    className="scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 rounded-md border"
                >
                    <table className="w-full table-auto text-left text-sm">
                        {renderHeader()}
                        {loading ? (
                            <tbody>
                                <tr>
                                    <td
                                        className="px-3 py-4"
                                        colSpan={columns.length}
                                    >
                                        {t('ui.loading.text')}
                                    </td>
                                </tr>
                            </tbody>
                        ) : data.length === 0 ? (
                            <tbody>
                                <tr>
                                    <td
                                        className="px-3 py-6"
                                        colSpan={columns.length}
                                    >
                                        <EmptyState message={t('ui.errors.noRecordsFound')} />
                                    </td>
                                </tr>
                            </tbody>
                        ) : (
                            renderVirtualizedBody()
                        )}
                    </table>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full table-auto text-left text-sm">
                        {renderHeader()}
                        {renderStandardBody()}
                    </table>
                </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                    {t('ui.table.pageInfo', { page, pageCount })}
                    {useVirtualRendering && (
                        <span className="ml-2 text-blue-600">(virtualized)</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <span>{t('ui.table.rows')}:</span>
                        <select
                            className="rounded border px-2 py-1"
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            aria-label={t('ui.accessibility.rowsPerPage')}
                        >
                            {/* Extended options for virtualized tables */}
                            {[10, 20, 30, 50, 100, 200].map((n) => (
                                <option
                                    key={n}
                                    value={n}
                                >
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="rounded border px-2 py-1 disabled:opacity-50"
                            onClick={() => onPageChange(Math.max(1, page - 1))}
                            disabled={page <= 1}
                        >
                            {t('ui.table.prev')}
                        </button>
                        <button
                            type="button"
                            className="rounded border px-2 py-1 disabled:opacity-50"
                            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                            disabled={page >= pageCount}
                        >
                            {t('ui.table.next')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Re-export presets for convenience
 */
export { TABLE_VIRTUALIZATION_PRESETS };

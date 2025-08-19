import { cn } from '@/lib/utils';
import {
    type ColumnDef,
    type SortingState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable
} from '@tanstack/react-table';
import type { ReactNode } from 'react';

export type DataTableSort = ReadonlyArray<{
    readonly id: string;
    readonly desc: boolean;
}>;

export type DataTableColumn<TData> = {
    readonly id: string;
    readonly header: ReactNode;
    readonly accessorKey?: keyof TData & string;
    readonly cell?: (ctx: { readonly row: TData }) => ReactNode;
    readonly enableSorting?: boolean;
    readonly enableHiding?: boolean;
};

export type DataTableProps<TData> = {
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
};

/**
 * DataTable is a thin wrapper over TanStack Table providing a stable public API.
 * Migrate the internals freely without affecting consumers.
 */
export const DataTable = <TData,>({
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
    onColumnVisibilityChange
}: DataTableProps<TData>) => {
    const internalColumns: ColumnDef<TData>[] = columns.map((col) => ({
        id: col.id,
        accessorKey: col.accessorKey,
        header: () => col.header,
        cell: (info) =>
            col.cell ? col.cell({ row: info.row.original }) : String(info.getValue() ?? ''),
        enableSorting: col.enableSorting ?? true,
        enableHiding: col.enableHiding ?? true
    }));

    const sortingState: SortingState = sort.map((s) => ({
        id: s.id,
        desc: s.desc
    }));

    const table = useReactTable<TData>({
        data: data as TData[],
        columns: internalColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: (updater) => {
            const next = typeof updater === 'function' ? updater(sortingState) : updater;
            onSortChange(next.map((s) => ({ id: s.id, desc: s.desc })));
        },
        state: {
            sorting: sortingState,
            columnVisibility
        },
        onColumnVisibilityChange: (updater) => {
            const next = typeof updater === 'function' ? updater(columnVisibility) : updater;
            onColumnVisibilityChange(next as Record<string, boolean>);
        }
    });

    const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
                <table className="w-full table-auto text-left text-sm">
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
                                                    aria-label="Sort column"
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
                                                flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    className="px-3 py-4"
                                    colSpan={columns.length}
                                >
                                    Loading...
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td
                                    className="px-3 py-6"
                                    colSpan={columns.length}
                                >
                                    No records found
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={rowId(row.original)}
                                    className="border-t"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className="px-3 py-2"
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                    Page {page} of {pageCount}
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <span>Rows:</span>
                        <select
                            className="rounded border px-2 py-1"
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            aria-label="Rows per page"
                        >
                            {[10, 20, 30, 50].map((n) => (
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
                            Prev
                        </button>
                        <button
                            type="button"
                            className="rounded border px-2 py-1 disabled:opacity-50"
                            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                            disabled={page >= pageCount}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

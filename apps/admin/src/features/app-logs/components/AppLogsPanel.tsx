/**
 * AppLogsPanel
 *
 * Main panel for the admin application log viewer (SPEC-184 T-013).
 * Renders a filterable, paginated table of persisted application log entries
 * fetched from GET /api/v1/admin/logs.
 */
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircleIcon, FileTextIcon, LoaderIcon } from '@repo/icons';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useAppLogsQuery } from '../hooks';
import type { AppLogEntry, AppLogEntryFilter } from '../types';
import { AppLogFilters } from './AppLogFilters';
import { AppLogLevelBadge } from './AppLogLevelBadge';
import { AppLogMessageCell } from './AppLogMessageCell';

/** Default filter / pagination state. */
const DEFAULT_FILTER: AppLogEntryFilter = {
    page: 1,
    pageSize: 50
};

/**
 * Formats a Date or date string to a human-readable local timestamp.
 *
 * @param value - Date instance or ISO string.
 * @returns Formatted date+time string.
 */
function formatTimestamp(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value);
    return d.toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/** Column definitions for the log entry table. */
const LOG_COLUMNS: ColumnDef<AppLogEntry>[] = [
    {
        id: 'loggedAt',
        header: 'Fecha/Hora',
        accessorKey: 'loggedAt',
        cell: ({ row }) => (
            <span
                className="whitespace-nowrap text-muted-foreground text-xs"
                data-testid="log-cell-timestamp"
            >
                {formatTimestamp(row.original.loggedAt)}
            </span>
        )
    },
    {
        id: 'level',
        header: 'Nivel',
        accessorKey: 'level',
        cell: ({ row }) => (
            <span data-testid="log-cell-level">
                <AppLogLevelBadge level={row.original.level} />
            </span>
        )
    },
    {
        id: 'category',
        header: 'Categoría',
        accessorKey: 'category',
        cell: ({ row }) => (
            <span
                className="text-xs"
                data-testid="log-cell-category"
            >
                {row.original.category ?? '—'}
            </span>
        )
    },
    {
        id: 'label',
        header: 'Etiqueta',
        accessorKey: 'label',
        cell: ({ row }) => (
            <span
                className="text-xs"
                data-testid="log-cell-label"
            >
                {row.original.label ?? '—'}
            </span>
        )
    },
    {
        id: 'request',
        header: 'Solicitud',
        cell: ({ row }) => {
            const { method, path } = row.original;
            if (!method && !path) {
                return (
                    <span
                        className="text-xs"
                        data-testid="log-request-cell"
                    >
                        —
                    </span>
                );
            }
            return (
                <span
                    className="flex max-w-[220px] items-center gap-1.5 text-xs"
                    data-testid="log-request-cell"
                >
                    {method && (
                        <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono font-semibold text-foreground">
                            {method}
                        </span>
                    )}
                    {path && (
                        <span
                            className="truncate text-muted-foreground"
                            title={path}
                        >
                            {path}
                        </span>
                    )}
                </span>
            );
        }
    },
    {
        id: 'message',
        header: 'Mensaje',
        accessorKey: 'message',
        cell: ({ row }) => (
            <AppLogMessageCell
                message={row.original.message}
                data={row.original.data}
                requestId={row.original.requestId}
                userId={row.original.userId}
                method={row.original.method}
                path={row.original.path}
            />
        )
    }
];

/**
 * Main application log viewer panel.
 *
 * Renders filter controls and a server-paginated table of log entries.
 */
export function AppLogsPanel() {
    const [filter, setFilter] = useState<AppLogEntryFilter>(DEFAULT_FILTER);

    const { data, isLoading, error } = useAppLogsQuery(filter);

    const items = useMemo(() => data?.items ?? [], [data]);

    const table = useReactTable<AppLogEntry>({
        data: items,
        columns: LOG_COLUMNS,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        rowCount: data?.total ?? 0
    });

    const pageCount = data ? Math.max(1, Math.ceil(data.total / Math.max(1, filter.pageSize))) : 1;

    const handleFilterChange = (next: AppLogEntryFilter) => {
        setFilter(next);
    };

    const handlePageChange = (page: number) => {
        setFilter((prev) => ({ ...prev, page }));
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilter((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }));
    };

    return (
        <div
            className="space-y-4"
            data-testid="app-logs-panel"
        >
            {/* Filter controls */}
            <AppLogFilters
                filter={filter}
                onChange={handleFilterChange}
            />

            {/* Loading state */}
            {isLoading && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p
                            className="mt-4 text-muted-foreground text-sm"
                            data-testid="app-logs-loading"
                        >
                            Cargando registros…
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Error state */}
            {!isLoading && error && (
                <Card className="border-destructive">
                    <CardContent className="py-12 text-center">
                        <AlertCircleIcon className="mx-auto h-8 w-8 text-destructive" />
                        <p
                            className="mt-4 text-destructive"
                            data-testid="app-logs-error"
                        >
                            Error al cargar los registros
                        </p>
                        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!isLoading && !error && items.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                        <FileTextIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p
                            className="mt-4 text-muted-foreground"
                            data-testid="app-logs-empty"
                        >
                            Sin registros
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Data table */}
            {!isLoading && !error && items.length > 0 && (
                <div className="space-y-3">
                    <div className="overflow-x-auto rounded-md border bg-card">
                        <table className="w-full min-w-max table-auto text-left text-sm lg:min-w-0">
                            <thead className="bg-muted text-foreground">
                                {table.getHeaderGroups().map((hg) => (
                                    <tr key={hg.id}>
                                        {hg.headers.map((header) => (
                                            <th
                                                key={header.id}
                                                scope="col"
                                                className="select-none px-3 py-2 font-medium"
                                            >
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.original.id}
                                        className="border-t"
                                        data-testid="log-row"
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
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Página {filter.page} de {pageCount} ({data?.total ?? 0} registros)
                        </span>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2">
                                <span>Filas:</span>
                                <select
                                    className="rounded border px-2 py-1 text-sm"
                                    value={filter.pageSize}
                                    onChange={handlePageSizeChange}
                                    aria-label="Filas por página"
                                    data-testid="log-page-size"
                                >
                                    {[20, 50, 100].map((n) => (
                                        <option
                                            key={n}
                                            value={n}
                                        >
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button
                                type="button"
                                className="rounded border px-2 py-1 disabled:opacity-50"
                                onClick={() => handlePageChange(Math.max(1, filter.page - 1))}
                                disabled={filter.page <= 1}
                                data-testid="log-prev-page"
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                className="rounded border px-2 py-1 disabled:opacity-50"
                                onClick={() =>
                                    handlePageChange(Math.min(pageCount, filter.page + 1))
                                }
                                disabled={filter.page >= pageCount}
                                data-testid="log-next-page"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

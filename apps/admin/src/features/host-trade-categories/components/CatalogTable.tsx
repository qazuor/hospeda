/**
 * @file CatalogTable.tsx
 * @description Presentational TanStack Table shared by the groups and the
 * categories tabs (HOS-919 T-043, T-044).
 *
 * The page owns filtering and pagination server-side, so the table has no
 * client-side model beyond the core row model. Row actions are passed in as a
 * render prop because which buttons a row shows depends on the viewer's
 * permissions, which this component does not know about.
 */

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useTranslations } from '@/hooks/use-translations';
import { catalogKey } from '../lib/i18n-keys';

/** Props for {@link CatalogTable}. */
export interface CatalogTableProps<TRow extends { readonly id: string }> {
    /** Test id prefix: rows render as `<prefix>-row-<id>`. */
    readonly testPrefix: string;
    readonly rows: readonly TRow[];
    readonly columns: ColumnDef<TRow>[];
    readonly isLoading: boolean;
    readonly isError: boolean;
}

const HEAD = 'px-3 py-2 text-left font-medium text-muted-foreground text-xs uppercase';
const CELL = 'px-3 py-2 align-middle text-sm';

/**
 * Renders catalog rows, or the loading, error or empty state.
 *
 * @param props - {@link CatalogTableProps}
 */
export function CatalogTable<TRow extends { readonly id: string }>({
    testPrefix,
    rows,
    columns,
    isLoading,
    isError
}: CatalogTableProps<TRow>) {
    const { t } = useTranslations();
    const table = useReactTable({
        data: rows as TRow[],
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id
    });

    if (isLoading) {
        return (
            <p className="p-4 text-muted-foreground text-sm">
                {t(catalogKey({ path: 'loading' }))}
            </p>
        );
    }
    if (isError) {
        return (
            <p
                className="p-4 text-destructive text-sm"
                role="alert"
            >
                {t(catalogKey({ path: 'error' }))}
            </p>
        );
    }
    if (rows.length === 0) {
        return (
            <p className="p-4 text-muted-foreground text-sm">{t(catalogKey({ path: 'empty' }))}</p>
        );
    }

    return (
        <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse">
                <thead className="border-b bg-muted/40">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className={HEAD}
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
                            key={row.id}
                            className="border-b last:border-b-0"
                            data-testid={`${testPrefix}-row-${row.id}`}
                        >
                            {row.getVisibleCells().map((cell) => (
                                <td
                                    key={cell.id}
                                    className={CELL}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

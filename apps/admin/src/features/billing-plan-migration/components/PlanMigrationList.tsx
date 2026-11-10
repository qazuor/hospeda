import type { TranslationKey } from '@repo/i18n';
import type { PlanMigrationListItem } from '@repo/schemas';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { usePlanMigrationList } from '../hooks/usePlanMigrationReads';

const states = ['PARA_RESOLVER', 'PENDIENTE', 'APLICADA', 'FUERA', 'CANCELADA'] as const;

/** Paginates announced migrations and opens one detail on this page. */
export function PlanMigrationList({ onSelect }: { readonly onSelect: (id: string) => void }) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-pages.planMigration.${key}` as TranslationKey, values);
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const list = usePlanMigrationList({ page, pageSize });
    const columns: ColumnDef<PlanMigrationListItem>[] = [
        {
            id: 'plans',
            header: tr('list.plans'),
            cell: ({ row }) => `${row.original.sourcePlanName} → ${row.original.targetPlanName}`
        },
        {
            id: 'reason',
            header: tr('list.reason'),
            cell: ({ row }) => tr(`reasons.${row.original.reason}`)
        },
        {
            id: 'announcedAt',
            header: tr('list.announcedAt'),
            cell: ({ row }) => row.original.announcedAt.toISOString().slice(0, 10)
        },
        {
            id: 'status',
            header: tr('list.status'),
            cell: ({ row }) => tr(row.original.cancelledAt ? 'list.cancelled' : 'list.active')
        },
        {
            id: 'counts',
            header: tr('list.counts'),
            cell: ({ row }) =>
                states
                    .map((status) => `${tr(`states.${status}`)}: ${row.original.counts[status]}`)
                    .join(' · ')
        },
        {
            id: 'open',
            header: tr('list.detail'),
            cell: ({ row }) => (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onSelect(row.original.id)}
                >
                    {tr('list.detail')}
                </Button>
            )
        }
    ];
    const table = useReactTable({
        data: list.data?.items ?? [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: list.data?.pagination.totalPages ?? 0
    });
    return (
        <section
            className="space-y-3"
            data-testid="plan-migration-list"
        >
            <h2 className="font-semibold text-lg">{tr('list.title')}</h2>
            {list.isLoading ? <p role="status">{tr('list.loading')}</p> : null}
            {list.isError ? <p role="alert">{tr('errors.generic')}</p> : null}
            {list.data?.items.length === 0 ? <p>{tr('list.empty')}</p> : null}
            {list.data?.items.length ? (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                {table.getHeaderGroups().map((group) =>
                                    group.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="p-2 text-left"
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                        </th>
                                    ))
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    data-testid="plan-migration-list-row"
                                    className="border-t"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className="p-2"
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
            ) : null}
            {list.data ? (
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                    >
                        {tr('list.previous')}
                    </Button>
                    <span>{tr('list.page', { page, total: list.data.pagination.totalPages })}</span>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={page >= list.data.pagination.totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        {tr('list.next')}
                    </Button>
                </div>
            ) : null}
        </section>
    );
}

/**
 * Staff list of listing AI chat conversations (HOS-2075), built on TanStack
 * Table with server-side pagination. Anonymous by contract: no user column.
 *
 * @module features/ai-conversations/components/AiConversationsTable
 */

import type { AiConversationListItem } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AiUsageBlockState } from '@/features/ai-usage/components/AiUsageBlockState';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import { useAiConversationsQuery } from '../hooks';
import type { AiConversationsSearch } from '../types';

const columnHelper = createColumnHelper<AiConversationListItem>();

/** Props for {@link AiConversationsTable}. */
export interface AiConversationsTableProps {
    readonly search: AiConversationsSearch;
    readonly onPageChange: (page: number) => void;
}

/**
 * Paginated conversations table. Each row links to the transcript.
 */
export function AiConversationsTable({ search, onPageChange }: AiConversationsTableProps) {
    const { t } = useTranslations();
    const { data, isLoading, isError } = useAiConversationsQuery(search);
    const base = 'admin-pages.ai.conversations';

    const columns = useMemo(
        () => [
            columnHelper.accessor('lastMessageAt', {
                header: () => t('admin-pages.ai.conversations.table.colLastMessage'),
                cell: (info) => formatDateWithTime({ date: info.getValue() })
            }),
            columnHelper.accessor('entityType', {
                header: () => t('admin-pages.ai.conversations.table.colVertical'),
                cell: (info) =>
                    t(
                        `${base}.verticals.${info.getValue()}` as `admin-pages.ai.conversations.verticals.accommodation`
                    )
            }),
            columnHelper.accessor('entityId', {
                header: () => t('admin-pages.ai.conversations.table.colListing'),
                cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>
            }),
            columnHelper.accessor('messageCount', {
                header: () => t('admin-pages.ai.conversations.table.colMessages'),
                cell: (info) => info.getValue().toLocaleString()
            }),
            columnHelper.accessor('firstQuestion', {
                header: () => t('admin-pages.ai.conversations.table.colFirstQuestion'),
                cell: (info) => (
                    <Link
                        to="/ai/conversations/$id"
                        params={{ id: info.row.original.id }}
                        className="text-primary hover:underline"
                    >
                        {info.getValue()}
                    </Link>
                )
            })
        ],
        [t]
    );

    const table = useReactTable({
        data: (data?.items ?? []) as AiConversationListItem[],
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true
    });

    const pagination = data?.pagination;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-pages.ai.conversations.table.title')}</CardTitle>
                <CardDescription>
                    {pagination
                        ? t('admin-pages.ai.conversations.table.total', { total: pagination.total })
                        : ''}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <AiUsageBlockState
                        status="loading"
                        title={t('admin-pages.ai.conversations.loading')}
                    />
                ) : isError ? (
                    <AiUsageBlockState
                        status="error"
                        title={t('admin-pages.ai.conversations.loadError')}
                    />
                ) : !data || data.items.length === 0 ? (
                    <AiUsageBlockState
                        status="empty"
                        title={t('admin-pages.ai.conversations.empty')}
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    {table.getHeaderGroups().map((hg) => (
                                        <tr
                                            key={hg.id}
                                            className="border-b"
                                        >
                                            {hg.headers.map((h) => (
                                                <th
                                                    key={h.id}
                                                    scope="col"
                                                    className="px-4 py-3 text-left font-medium"
                                                >
                                                    {flexRender(
                                                        h.column.columnDef.header,
                                                        h.getContext()
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
                                            className="border-b hover:bg-muted/50"
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <td
                                                    key={cell.id}
                                                    className="px-4 py-3"
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
                        {pagination && (
                            <div className="mt-4 flex items-center justify-between">
                                <span className="text-muted-foreground text-sm">
                                    {t('admin-pages.ai.conversations.table.pageOf', {
                                        page: pagination.page,
                                        totalPages: Math.max(pagination.totalPages, 1)
                                    })}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={pagination.page <= 1}
                                        onClick={() => onPageChange(pagination.page - 1)}
                                    >
                                        {t('admin-pages.ai.conversations.table.prev')}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={pagination.page >= pagination.totalPages}
                                        onClick={() => onPageChange(pagination.page + 1)}
                                    >
                                        {t('admin-pages.ai.conversations.table.next')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

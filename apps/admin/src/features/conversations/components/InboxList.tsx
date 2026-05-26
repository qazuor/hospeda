/**
 * InboxList component.
 *
 * TanStack Table rendering the owner's paginated conversation inbox.
 * Columns: guest identity, accommodation name, status badge,
 * unread count, last activity timestamp.
 * Default sort: lastActivityAt DESC.
 * Row click navigates to /conversations/$id.
 * Pagination via page/pageSize URL search params.
 */

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { useNavigate } from '@tanstack/react-router';
import {
    type SortingState,
    flexRender,
    getCoreRowModel,
    useReactTable
} from '@tanstack/react-table';
import { useState } from 'react';
import { createConversationColumns } from '../config/columns';
import type { ConversationListItem } from '../types';

/** Props for InboxList */
export interface InboxListProps {
    /** Conversation rows to display */
    items: ConversationListItem[];
    /** Total records (for pagination) */
    total: number;
    /** Current page (1-indexed) */
    page: number;
    /** Page size */
    pageSize: number;
    /** Callback when page changes */
    onPageChange: (page: number) => void;
    /** Whether data is loading */
    isLoading?: boolean;
}

/**
 * Renders the conversations inbox as a table with pagination.
 *
 * @param props - InboxListProps
 */
export function InboxList({
    items,
    total,
    page,
    pageSize,
    onPageChange,
    isLoading
}: InboxListProps) {
    const { t } = useTranslations();
    const navigate = useNavigate();
    const columns = createConversationColumns();

    const [sorting, setSorting] = useState<SortingState>([{ id: 'lastActivityAt', desc: true }]);

    const table = useReactTable({
        data: items,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        rowCount: total
    });

    const totalPages = Math.ceil(total / pageSize);

    if (!isLoading && items.length === 0) {
        return (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
                <p className="text-center text-muted-foreground text-sm">
                    {t('conversations.empty.ownerInbox')}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Table */}
            <div className="overflow-hidden rounded-lg border bg-card">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const sortHandler = header.column.getCanSort()
                                        ? header.column.getToggleSortingHandler()
                                        : undefined;
                                    return (
                                        <th
                                            key={header.id}
                                            className="px-4 py-3 text-left font-medium text-muted-foreground"
                                            onClick={sortHandler}
                                            onKeyDown={
                                                sortHandler
                                                    ? (e) => {
                                                          if (e.key === 'Enter' || e.key === ' ') {
                                                              e.preventDefault();
                                                              sortHandler(e);
                                                          }
                                                      }
                                                    : undefined
                                            }
                                            style={
                                                sortHandler
                                                    ? { cursor: 'pointer', userSelect: 'none' }
                                                    : undefined
                                            }
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef.header,
                                                      header.getContext()
                                                  )}
                                            {{
                                                asc: ' ↑',
                                                desc: ' ↓'
                                            }[header.column.getIsSorted() as string] ?? null}
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {isLoading
                            ? Array.from({ length: pageSize }, (_, idx) => `skel-row-${idx}`).map(
                                  (skelKey) => (
                                      <tr
                                          key={skelKey}
                                          className="border-t"
                                      >
                                          {columns.map((col) => (
                                              <td
                                                  key={String(col.id)}
                                                  className="px-4 py-3"
                                              >
                                                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                                              </td>
                                          ))}
                                      </tr>
                                  )
                              )
                            : table.getRowModel().rows.map((row) => {
                                  const navigateToThread = () =>
                                      navigate({
                                          to: '/conversations/$id',
                                          params: { id: row.original.id }
                                      });
                                  return (
                                      <tr
                                          key={row.id}
                                          className="cursor-pointer border-t transition-colors hover:bg-muted/30"
                                          onClick={navigateToThread}
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault();
                                                  navigateToThread();
                                              }
                                          }}
                                          tabIndex={0}
                                          // biome-ignore lint/a11y/useSemanticElements: clickable table rows are the established admin list pattern; full keyboard support via onKeyDown
                                          role="button"
                                          aria-label={`${t('conversations.actions.viewConversation')} ${row.original.id}`}
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
                                  );
                              })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                        {t('ui.table.pageInfo', {
                            page: String(page),
                            pageCount: String(totalPages)
                        })}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1 || isLoading}
                        >
                            {t('ui.pagination.previous')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages || isLoading}
                        >
                            {t('ui.pagination.next')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

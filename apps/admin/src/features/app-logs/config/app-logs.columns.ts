/**
 * Column definitions for the app-logs entity list (SPEC-184 migration).
 *
 * Only `loggedAt` and `level` are sortable — those are the only fields
 * whitelisted by the API route. All other columns explicitly set
 * `enableSorting: false` to prevent the framework from sending invalid sort
 * params.
 */
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { ColumnType } from '@/components/table/DataTable';
import type { AppLogEntry } from '@repo/schemas';
import { createElement } from 'react';
import { AppLogLevelBadge } from '../components/AppLogLevelBadge';
import { AppLogMessageCell } from '../components/AppLogMessageCell';

/**
 * Formats a Date or ISO string to a human-readable local timestamp (es-AR).
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

/**
 * Renders the request cell: compact "METHOD /path" display.
 * Reuses the markup from the bespoke AppLogsPanel request column.
 */
function RequestCell({ row }: { readonly row: AppLogEntry }) {
    const { method, path } = row;
    if (!method && !path) {
        return createElement(
            'span',
            { className: 'text-xs', 'data-testid': 'log-request-cell' },
            '—'
        );
    }
    return createElement(
        'span',
        {
            className: 'flex max-w-[220px] items-center gap-1.5 text-xs',
            'data-testid': 'log-request-cell'
        },
        method
            ? createElement(
                  'span',
                  {
                      className:
                          'shrink-0 rounded bg-muted px-1 py-0.5 font-mono font-semibold text-foreground'
                  },
                  method
              )
            : null,
        path
            ? createElement(
                  'span',
                  { className: 'truncate text-muted-foreground', title: path },
                  path
              )
            : null
    );
}

/**
 * Creates the column definitions for the app-logs list.
 *
 * @param t - Translation function from the entity-list framework.
 * @returns Readonly array of column configurations.
 */
export const createAppLogsColumns = (t: ColumnTFunction): readonly ColumnConfig<AppLogEntry>[] => [
    {
        id: 'loggedAt',
        header: t('admin-entities.columns.appLog.loggedAt'),
        accessorKey: 'loggedAt',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                {
                    className: 'whitespace-nowrap text-muted-foreground text-xs',
                    'data-testid': 'log-cell-timestamp'
                },
                formatTimestamp(row.loggedAt)
            )
    },
    {
        id: 'level',
        header: t('admin-entities.columns.appLog.level'),
        accessorKey: 'level',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                { 'data-testid': 'log-cell-level' },
                createElement(AppLogLevelBadge, { level: row.level })
            )
    },
    {
        id: 'category',
        header: t('admin-entities.columns.appLog.category'),
        accessorKey: 'category',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                { className: 'text-xs', 'data-testid': 'log-cell-category' },
                row.category ?? '—'
            )
    },
    {
        id: 'label',
        header: t('admin-entities.columns.appLog.label'),
        accessorKey: 'label',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                { className: 'text-xs', 'data-testid': 'log-cell-label' },
                row.label ?? '—'
            )
    },
    {
        id: 'request',
        header: t('admin-entities.columns.appLog.request'),
        // accessorKey must reference a real field; 'method' is used as proxy
        // since the WIDGET renderer accesses the full row
        accessorKey: 'method',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(RequestCell, { row })
    },
    {
        id: 'message',
        header: t('admin-entities.columns.appLog.message'),
        accessorKey: 'message',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(AppLogMessageCell, {
                message: row.message,
                data: row.data ?? null,
                requestId: row.requestId ?? null,
                userId: row.userId ?? null,
                method: row.method ?? null,
                path: row.path ?? null
            })
    }
];

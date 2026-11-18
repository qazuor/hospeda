/**
 * Column definitions for the admin assistant activity log (HOS-2349).
 *
 * One row per assistant (MCP) tool call. Only `loggedAt` is sortable: it is
 * the only order the API accepts. Every value is rendered as plain text; the
 * assistant name is client-declared (untrusted) and never rendered as markup.
 */

import type { McpActivityItem } from '@repo/schemas';
import { createElement } from 'react';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { ColumnType } from '@/components/table/DataTable';
import { formatDateWithSeconds } from '@/lib/format-helpers';
import { McpActivityOutcomeBadge } from '../components/McpActivityOutcomeBadge';

/** Length of the id prefix shown when nothing better names a user or target. */
const SHORT_ID_LENGTH = 8;

/**
 * Renders the user the assistant acted for: display name, else email, else
 * the short id. The full id and email are on hover.
 *
 * @param props.row - The activity item.
 */
export function McpActivityUserCell({ row }: { readonly row: McpActivityItem }) {
    const label = row.actorName ?? row.actorEmail ?? row.actorId?.slice(0, SHORT_ID_LENGTH) ?? '—';
    const title = [row.actorId, row.actorEmail].filter(Boolean).join(' · ') || undefined;
    return createElement(
        'span',
        { className: 'flex flex-col text-xs', title, 'data-testid': 'mcp-activity-cell-user' },
        createElement('span', { className: 'font-medium' }, label),
        row.actorName && row.actorEmail
            ? createElement('span', { className: 'text-muted-foreground' }, row.actorEmail)
            : null
    );
}

/**
 * Creates the column definitions of the assistant activity list.
 *
 * @param t - Translation function from the entity-list framework.
 * @returns Readonly array of column configurations.
 */
export const createMcpActivityColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<McpActivityItem>[] => [
    {
        id: 'loggedAt',
        header: t('admin-entities.columns.mcpActivity.loggedAt'),
        accessorKey: 'loggedAt',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                {
                    className: 'whitespace-nowrap text-muted-foreground text-xs',
                    'data-testid': 'mcp-activity-cell-timestamp'
                },
                formatDateWithSeconds({ date: row.loggedAt })
            )
    },
    {
        id: 'user',
        header: t('admin-entities.columns.mcpActivity.user'),
        accessorKey: 'actorId',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(McpActivityUserCell, { row })
    },
    {
        id: 'tool',
        header: t('admin-entities.columns.mcpActivity.tool'),
        accessorKey: 'tool',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                { className: 'font-mono text-xs', 'data-testid': 'mcp-activity-cell-tool' },
                row.tool
            )
    },
    {
        id: 'access',
        header: t('admin-entities.columns.mcpActivity.access'),
        accessorKey: 'isWrite',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                { className: 'text-xs', 'data-testid': 'mcp-activity-cell-access' },
                row.isWrite
                    ? t('admin-filters.mcpActivity.access.write')
                    : t('admin-filters.mcpActivity.access.read')
            )
    },
    {
        id: 'outcome',
        header: t('admin-entities.columns.mcpActivity.outcome'),
        accessorKey: 'outcome',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(McpActivityOutcomeBadge, {
                outcome: row.outcome,
                label: t(`admin-filters.mcpActivity.outcome.${row.outcome}`)
            })
    },
    {
        id: 'errorCode',
        header: t('admin-entities.columns.mcpActivity.errorCode'),
        accessorKey: 'errorCode',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                {
                    className: 'font-mono text-muted-foreground text-xs',
                    'data-testid': 'mcp-activity-cell-error-code'
                },
                row.errorCode ?? '—'
            )
    },
    {
        id: 'client',
        header: t('admin-entities.columns.mcpActivity.client'),
        accessorKey: 'client',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                {
                    className: 'break-all text-xs',
                    title: row.client.id,
                    'data-testid': 'mcp-activity-cell-client'
                },
                row.client.name ?? row.client.id
            )
    },
    {
        id: 'target',
        header: t('admin-entities.columns.mcpActivity.target'),
        accessorKey: 'target',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                {
                    className: 'break-all text-xs',
                    title: row.target ? `${row.target.type}:${row.target.id}` : undefined,
                    'data-testid': 'mcp-activity-cell-target'
                },
                row.target
                    ? (row.target.label ??
                          `${row.target.type}:${row.target.id.slice(0, SHORT_ID_LENGTH)}`)
                    : '—'
            )
    }
];

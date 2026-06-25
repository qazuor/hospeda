/**
 * Column definitions for the audit/security log entity lists (SPEC-162).
 *
 * Shared by both the audit-log and security-log viewers — the column set is
 * identical; only the page title and API endpoint differ. Only `loggedAt` and
 * `severity` are sortable (the only fields whitelisted by the API routes); all
 * other columns explicitly set `enableSorting: false`.
 */
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { ColumnType } from '@/components/table/DataTable';
import type { AuditLogEntry } from '@repo/schemas';
import { createElement } from 'react';
import { AuditMessageCell } from '../components/AuditMessageCell';
import { AuditSeverityBadge } from '../components/AuditSeverityBadge';

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
 * Renders the actor cell: short UUID with the full value on hover.
 * Exported for direct unit testing.
 */
export function ActorCell({ row }: { readonly row: AuditLogEntry }) {
    return createElement(
        'span',
        {
            className: 'font-mono text-muted-foreground text-xs',
            title: row.actorId ?? row.actorRole ?? undefined,
            'data-testid': 'audit-cell-actor'
        },
        row.actorId ? row.actorId.slice(0, 8) : (row.actorRole ?? '—')
    );
}

/**
 * Creates the column definitions for the audit/security log lists.
 *
 * @param t - Translation function from the entity-list framework.
 * @returns Readonly array of column configurations.
 */
export const createAuditLogsColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<AuditLogEntry>[] => [
    {
        id: 'loggedAt',
        header: t('admin-entities.columns.auditLog.loggedAt'),
        accessorKey: 'loggedAt',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                {
                    className: 'whitespace-nowrap text-muted-foreground text-xs',
                    'data-testid': 'audit-cell-timestamp'
                },
                formatTimestamp(row.loggedAt)
            )
    },
    {
        id: 'severity',
        header: t('admin-entities.columns.auditLog.severity'),
        accessorKey: 'severity',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                { 'data-testid': 'audit-cell-severity' },
                createElement(AuditSeverityBadge, { severity: row.severity })
            )
    },
    {
        id: 'eventType',
        header: t('admin-entities.columns.auditLog.eventType'),
        accessorKey: 'eventType',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                { className: 'font-mono text-xs', 'data-testid': 'audit-cell-event' },
                row.eventType
            )
    },
    {
        id: 'actor',
        header: t('admin-entities.columns.auditLog.actor'),
        // accessorKey must reference a real field; the WIDGET renderer reads the full row.
        accessorKey: 'actorId',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(ActorCell, { row })
    },
    {
        id: 'targetId',
        header: t('admin-entities.columns.auditLog.target'),
        accessorKey: 'targetId',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(
                'span',
                {
                    className: 'break-all text-xs',
                    title: row.targetId ?? undefined,
                    'data-testid': 'audit-cell-target'
                },
                row.targetId ?? '—'
            )
    },
    {
        id: 'message',
        header: t('admin-entities.columns.auditLog.message'),
        accessorKey: 'message',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(AuditMessageCell, {
                message: row.message,
                data: row.data ?? null
            })
    }
];

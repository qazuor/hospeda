/**
 * TanStack Table column definitions for the conversations InboxList.
 *
 * Columns: guest identity, accommodation name, status badge,
 * unread count, last activity timestamp.
 * Default sort: last_activity_at DESC.
 */

import { createColumnHelper } from '@tanstack/react-table';
import { StatusBadge } from '../components/StatusBadge';
import type { ConversationListItem, GuestIdentity } from '../types';
import { formatRelativeTime } from '../utils';

const columnHelper = createColumnHelper<ConversationListItem>();

/**
 * Resolve a display name from a GuestIdentity.
 *
 * Prefers the authenticated user name, falls back to anonName, then email.
 *
 * @param guest - GuestIdentity object
 * @returns Display string
 */
function resolveGuestName(guest: GuestIdentity): string {
    return guest.name ?? guest.anonName ?? guest.email ?? '—';
}

/**
 * Create column definitions for the inbox conversations table.
 *
 * @returns Array of ColumnDef<ConversationListItem>
 */
export function createConversationColumns() {
    return [
        columnHelper.accessor((row) => resolveGuestName(row.guest), {
            id: 'guest',
            header: 'conversations.inbox.guest',
            enableSorting: false,
            cell: ({ getValue, row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{getValue()}</span>
                    {row.original.guest.email && (
                        <span className="text-muted-foreground text-xs">
                            {row.original.guest.email}
                        </span>
                    )}
                </div>
            )
        }),
        columnHelper.accessor('accommodation', {
            id: 'accommodation',
            header: 'conversations.inbox.accommodation',
            enableSorting: false,
            cell: ({ getValue }) => <span className="text-sm">{getValue().name}</span>
        }),
        columnHelper.accessor('status', {
            id: 'status',
            header: 'conversations.inbox.status',
            enableSorting: true,
            cell: ({ getValue }) => <StatusBadge status={getValue()} />
        }),
        columnHelper.accessor('unreadCountByOwner', {
            id: 'unreadCount',
            header: 'conversations.inbox.unreadCount',
            enableSorting: true,
            cell: ({ getValue }) => {
                const count = getValue();
                return count > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-destructive-foreground text-xs">
                        {count}
                    </span>
                ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                );
            }
        }),
        columnHelper.accessor('lastActivityAt', {
            id: 'lastActivityAt',
            header: 'conversations.inbox.lastActivity',
            enableSorting: true,
            cell: ({ getValue }) => (
                <span className="text-muted-foreground text-sm">
                    {formatRelativeTime(getValue())}
                </span>
            ),
            sortDescFirst: true
        })
    ];
}

/**
 * UnreadBadge component for the conversations sidebar item.
 *
 * Polls GET /api/v1/admin/conversations/unread-count every 30 seconds
 * and renders a count badge when count > 0.
 */

import { useUnreadCount } from '../hooks/useUnreadCount';

/**
 * Renders a badge showing the number of unread conversations.
 * Hidden when count is 0. Polls every 30 seconds.
 */
export function UnreadBadge() {
    const { data } = useUnreadCount();
    const count = data?.count ?? 0;

    if (count === 0) return null;

    return (
        <span
            className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-destructive-foreground text-xs"
            aria-label={`${count} unread messages`}
        >
            {count > 99 ? '99+' : count}
        </span>
    );
}

/**
 * SidebarItem Component
 *
 * Individual sidebar link item for the NEW config-driven IA system (SPEC-154).
 *
 * Breaking changes from the OLD system:
 * - Label is now an I18nLabel resolved via `useLocalizedLabel` (not a plain string).
 * - Icon is now a string icon-name resolved via `resolveNavIcon` (not a ReactNode).
 * - Navigation uses `route` (not `href`).
 * - Items may be `disabled` (greyed-out with tooltip) when the user lacks
 *   permissions and `onMissing === 'disable'`.
 * - Unread badge is injected via the `unreadCount` prop (not embedded in item shape).
 */

import { useLocalizedLabel } from '@/hooks/use-localized-label';
import type { VisibleLinkItem } from '@/hooks/use-visible-sidebar-items';
import { resolveNavIcon } from '@/lib/nav-icon-map';
import { cn } from '@/lib/utils';
import { Link, useLocation } from '@tanstack/react-router';

export interface SidebarItemProps {
    /** The annotated link item from `useVisibleSidebarItems`. */
    item: VisibleLinkItem;
    /**
     * Optional unread badge count. When > 0, renders a badge bubble.
     * Injected externally (e.g. from `useUnreadCount` for conversations-inbox).
     */
    unreadCount?: number;
    /** Callback when item is clicked (e.g. close mobile drawer). */
    onClick?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * SidebarItem renders a single navigation link in the sidebar.
 *
 * Active state is determined by longest-prefix match of `item.route` against
 * the current pathname (`item.exact` forces exact-only matching).
 *
 * Disabled items (no access, `onMissing: 'disable'`) render greyed-out with
 * a tooltip "Requiere permiso" and prevent navigation.
 */
export function SidebarItem({ item, unreadCount = 0, onClick, className }: SidebarItemProps) {
    const location = useLocation();
    const label = useLocalizedLabel(item.label);
    const IconComponent = item.icon ? resolveNavIcon({ iconName: item.icon }) : undefined;

    const isActive = item.exact
        ? location.pathname === item.route
        : location.pathname === item.route || location.pathname.startsWith(`${item.route}/`);

    if (item.disabled) {
        return (
            <span
                title="Requiere permiso"
                className={cn(
                    'flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm opacity-40',
                    'text-muted-foreground',
                    className
                )}
                data-item-id={item.id}
                aria-disabled="true"
            >
                {IconComponent && (
                    <span
                        className="flex-shrink-0"
                        aria-hidden="true"
                    >
                        <IconComponent size="sm" />
                    </span>
                )}
                <span className="truncate">{label}</span>
            </span>
        );
    }

    return (
        <Link
            to={item.route}
            preload="intent"
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                'hover:bg-accent/50 hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground',
                className
            )}
            aria-current={isActive ? 'page' : undefined}
            data-item-id={item.id}
        >
            {IconComponent && (
                <span
                    className="flex-shrink-0"
                    aria-hidden="true"
                >
                    <IconComponent size="sm" />
                </span>
            )}
            <span className="truncate">{label}</span>
            {unreadCount > 0 && (
                <span
                    className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-destructive-foreground text-xs"
                    aria-label={`${unreadCount} unread messages`}
                >
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Link>
    );
}

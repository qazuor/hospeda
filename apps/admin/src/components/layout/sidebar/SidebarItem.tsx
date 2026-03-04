/**
 * SidebarItem Component
 *
 * Individual sidebar item for link or action types.
 * Part of Level 2 navigation (contextual sidebar).
 */

import type { SidebarItem as SidebarItemType } from '@/lib/sections/types';
import { cn } from '@/lib/utils';
import { Link, useLocation } from '@tanstack/react-router';

export interface SidebarItemProps {
    /** Item configuration */
    item: SidebarItemType;
    /** Callback when item is clicked */
    onClick?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * SidebarItem renders a single navigation item in the sidebar.
 */
export function SidebarItem({ item, onClick, className }: SidebarItemProps) {
    const location = useLocation();

    // Handle separator type
    if (item.type === 'separator') {
        return <hr className="my-2 border-border/50 border-t" />;
    }

    const displayLabel = item.label || '';
    const isActive = item.type === 'link' && item.href === location.pathname;

    // Render link item
    if (item.type === 'link' && item.href) {
        return (
            <Link
                to={item.href}
                preload="intent"
                onClick={onClick}
                className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    'hover:bg-accent/50 hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground',
                    className
                )}
                aria-current={isActive ? 'page' : undefined}
                data-item-id={item.id}
            >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span className="truncate">{displayLabel}</span>
            </Link>
        );
    }

    // Render action item
    if (item.type === 'action' && item.onClick) {
        return (
            <button
                type="button"
                onClick={() => {
                    item.onClick?.();
                    onClick?.();
                }}
                className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    className
                )}
                data-item-id={item.id}
            >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span className="truncate">{displayLabel}</span>
            </button>
        );
    }

    return null;
}

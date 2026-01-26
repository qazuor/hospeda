/**
 * SidebarGroup Component
 *
 * Collapsible group of sidebar items.
 * Part of Level 2 navigation (contextual sidebar).
 *
 * Accessibility features:
 * - aria-expanded for collapse state
 * - aria-controls to link button to content
 * - role="group" for semantic grouping
 * - Keyboard navigation (Enter/Space to toggle)
 */

import { type SidebarItem as SidebarItemType, isGroupActive } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { DropdownIcon } from '@repo/icons';
import { useLocation } from '@tanstack/react-router';
import { useCallback, useId, useState } from 'react';
import { SidebarItem } from './SidebarItem';

export interface SidebarGroupProps {
    /** Group item configuration */
    item: SidebarItemType;
    /** Callback when any child item is clicked */
    onItemClick?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * SidebarGroup renders a collapsible group of navigation items.
 */
export function SidebarGroup({ item, onItemClick, className }: SidebarGroupProps) {
    const location = useLocation();
    const contentId = useId();

    // Determine if group should be expanded
    const hasActiveChild = isGroupActive(item, location.pathname);
    const [isExpanded, setIsExpanded] = useState(item.defaultExpanded || hasActiveChild);

    // Toggle handler with keyboard support
    const handleToggle = useCallback(() => {
        setIsExpanded((prev) => !prev);
    }, []);

    // Don't render if not a group type
    if (item.type !== 'group' || !item.items) {
        return null;
    }

    const displayLabel = item.label || '';

    return (
        <div
            className={cn('mb-1', className)}
            aria-labelledby={`${contentId}-label`}
        >
            {/* Group header */}
            <button
                type="button"
                id={`${contentId}-label`}
                onClick={handleToggle}
                className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    'hover:bg-accent/50 hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    hasActiveChild ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
                aria-expanded={isExpanded}
                aria-controls={contentId}
                data-group-id={item.id}
            >
                {item.icon && (
                    <span
                        className="flex-shrink-0"
                        aria-hidden="true"
                    >
                        {item.icon}
                    </span>
                )}
                <span className="flex-1 truncate text-left">{displayLabel}</span>
                <DropdownIcon
                    className={cn(
                        'h-4 w-4 flex-shrink-0 transition-transform duration-200',
                        isExpanded ? 'rotate-180' : ''
                    )}
                    aria-hidden="true"
                />
            </button>

            {/* Group children */}
            <div
                id={contentId}
                aria-labelledby={`${contentId}-label`}
                className={cn(
                    'overflow-hidden transition-all duration-200 ease-out',
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                )}
            >
                <div className="ml-3 space-y-0.5 border-border/50 border-l pt-1 pl-3">
                    {item.items.map((child) => {
                        if (child.type === 'group') {
                            return (
                                <SidebarGroup
                                    key={child.id}
                                    item={child}
                                    onItemClick={onItemClick}
                                />
                            );
                        }
                        return (
                            <SidebarItem
                                key={child.id}
                                item={child}
                                onClick={onItemClick}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

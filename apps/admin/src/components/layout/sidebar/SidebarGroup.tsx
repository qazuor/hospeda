/**
 * SidebarGroup Component
 *
 * Collapsible group of sidebar items for the NEW config-driven IA system
 * (SPEC-154).
 *
 * Breaking changes from the OLD system:
 * - Label is now an I18nLabel resolved via `useLocalizedLabel`.
 * - Icon is now a string icon-name resolved via `resolveNavIcon`.
 * - Uses `defaultOpen` (not `defaultExpanded`).
 * - Active state check uses `item.route` on child link items (not `href`).
 * - Groups may be `disabled` when the user lacks permissions.
 *
 * Accessibility features:
 * - aria-expanded for collapse state
 * - aria-controls to link button to content
 * - Keyboard navigation (Enter/Space to toggle)
 */

import { useLocalizedLabel } from '@/hooks/use-localized-label';
import type {
    VisibleGroupItem,
    VisibleLinkItem,
    VisibleSeparatorItem
} from '@/hooks/use-visible-sidebar-items';
import { resolveNavIcon } from '@/lib/nav-icon-map';
import { cn } from '@/lib/utils';
import { DropdownIcon } from '@repo/icons';
import { useLocation } from '@tanstack/react-router';
import { useCallback, useId, useState } from 'react';
import { SidebarItem } from './SidebarItem';

export interface SidebarGroupProps {
    /** The annotated group item from `useVisibleSidebarItems`. */
    item: VisibleGroupItem;
    /** Callback when any child item is clicked (e.g. close mobile drawer). */
    onItemClick?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Checks whether any direct-child link in the group is active for the current
 * pathname (prefix or exact match per the child's `exact` field).
 */
function hasActiveChild(
    items: ReadonlyArray<VisibleLinkItem | VisibleSeparatorItem>,
    pathname: string
): boolean {
    return items.some((child) => {
        if (child.type !== 'link') return false;
        if (child.exact) return pathname === child.route;
        return pathname === child.route || pathname.startsWith(`${child.route}/`);
    });
}

/**
 * SidebarGroup renders a collapsible group of navigation link items.
 *
 * The group is auto-expanded on mount when any child matches the current route,
 * or when `item.defaultOpen` is `true`. Disabled groups are rendered
 * greyed-out and prevent interaction.
 */
export function SidebarGroup({ item, onItemClick, className }: SidebarGroupProps) {
    const location = useLocation();
    const contentId = useId();
    const label = useLocalizedLabel(item.label);
    const IconComponent = item.icon ? resolveNavIcon({ iconName: item.icon }) : undefined;

    const groupHasActiveChild = hasActiveChild(item.items, location.pathname);
    const [isExpanded, setIsExpanded] = useState(item.defaultOpen || groupHasActiveChild);

    const handleToggle = useCallback(() => {
        if (!item.disabled) {
            setIsExpanded((prev) => !prev);
        }
    }, [item.disabled]);

    if (item.disabled) {
        return (
            <div
                className={cn('mb-1 opacity-40', className)}
                aria-label={label}
            >
                <span
                    title="Requiere permiso"
                    className={cn(
                        'flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm',
                        'text-muted-foreground'
                    )}
                    data-group-id={item.id}
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
                    <span className="flex-1 truncate text-left">{label}</span>
                    <DropdownIcon
                        className="h-4 w-4 flex-shrink-0"
                        aria-hidden="true"
                    />
                </span>
            </div>
        );
    }

    return (
        <div
            className={cn('mb-1', className)}
            aria-labelledby={`${contentId}-label`}
        >
            {/* Group header button */}
            <button
                type="button"
                id={`${contentId}-label`}
                onClick={handleToggle}
                className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    'hover:bg-accent/50 hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    groupHasActiveChild ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
                aria-expanded={isExpanded}
                aria-controls={contentId}
                data-group-id={item.id}
            >
                {IconComponent && (
                    <span
                        className="flex-shrink-0"
                        aria-hidden="true"
                    >
                        <IconComponent size="sm" />
                    </span>
                )}
                <span className="flex-1 truncate text-left">{label}</span>
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
                        if (child.type === 'separator') {
                            return (
                                <hr
                                    key={child.id}
                                    className="my-2 border-border/50 border-t"
                                />
                            );
                        }
                        return (
                            <SidebarItem
                                key={child.id}
                                item={child as VisibleLinkItem}
                                onClick={onItemClick}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * HeaderNavItem Component
 *
 * Individual navigation item for the header navbar.
 * Represents a top-level section (Level 1 navigation).
 */

import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { Link, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface HeaderNavItemProps {
    /** Section identifier */
    id: string;
    /** Display label */
    label: string;
    /** i18n key for the label */
    labelKey?: string;
    /** Route to navigate to */
    href: string;
    /** Icon component */
    icon?: ReactNode;
    /** Whether this section is currently active */
    isActive?: boolean;
    /** Click handler (optional, for custom behavior) */
    onClick?: () => void;
}

/**
 * HeaderNavItem renders a single navigation item in the header.
 * Supports active state styling and optional icons.
 */
export function HeaderNavItem({
    id,
    label,
    labelKey,
    href,
    icon,
    isActive,
    onClick
}: HeaderNavItemProps) {
    const { t } = useTranslations();
    const displayLabel = labelKey ? t(labelKey as TranslationKey) : label;

    return (
        <Link
            to={href}
            onClick={onClick}
            className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 font-medium text-sm transition-colors duration-150',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
            )}
            aria-current={isActive ? 'page' : undefined}
            data-section-id={id}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span className="hidden lg:inline">{displayLabel}</span>
        </Link>
    );
}

/**
 * Hook to determine if a section is active based on current route
 */
export function useIsHeaderItemActive(routes: string[]): boolean {
    const location = useLocation();
    const currentPath = location.pathname;

    // Check if current path matches any of the section routes
    return routes.some((pattern) => {
        // Handle glob patterns
        if (pattern.includes('**')) {
            const prefix = pattern.replace('/**', '').replace('/*', '');
            return currentPath === prefix || currentPath.startsWith(`${prefix}/`);
        }
        if (pattern.includes('*')) {
            const prefix = pattern.replace('/*', '');
            return currentPath === prefix || currentPath.startsWith(`${prefix}/`);
        }
        return currentPath === pattern;
    });
}

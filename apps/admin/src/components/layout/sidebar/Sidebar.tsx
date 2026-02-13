/**
 * Sidebar Component
 *
 * Contextual sidebar navigation (Level 2).
 * Content changes based on the active section from the header.
 */

import { useSidebarContext } from '@/contexts/sidebar-context';
import { useTranslations } from '@/hooks/use-translations';
import { filterByPermissions } from '@/lib/sections';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { CloseIcon } from '@repo/icons';
import { SidebarGroup } from './SidebarGroup';
import { SidebarItem } from './SidebarItem';

export interface SidebarProps {
    /** User permissions for filtering items */
    userPermissions?: string[];
    /** Additional CSS classes */
    className?: string;
}

/**
 * Sidebar renders the contextual navigation panel.
 * Only visible when isContextual is true.
 */
export function Sidebar({ userPermissions, className }: SidebarProps) {
    const { t } = useTranslations();
    const { config, isContextual, isMobileOpen, closeMobile, isCollapsed } = useSidebarContext();

    // Don't render if not contextual or no config
    if (!isContextual || !config) {
        return null;
    }

    // Filter items by permissions
    const filteredItems = filterByPermissions(config.items, userPermissions);

    const sidebarTitle = config.titleKey ? t(config.titleKey as TranslationKey) : config.title;

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={cn(
                    'fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 md:hidden',
                    isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
                onClick={closeMobile}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') closeMobile();
                }}
                aria-label={t('admin-common.aria.closeSidebarOverlay' as TranslationKey)}
            />

            {/* Sidebar panel */}
            <aside
                className={cn(
                    // Base styles
                    'z-30 flex flex-col border-r bg-sidebar',
                    // Mobile: fixed drawer
                    'fixed inset-y-0 top-14 left-0 w-64 transition-transform duration-200 ease-out md:sticky md:top-14 md:translate-x-0',
                    // Mobile open/closed state
                    isMobileOpen ? 'translate-x-0' : '-translate-x-full',
                    // Desktop collapsed state
                    isCollapsed && 'md:w-0 md:overflow-hidden md:border-r-0',
                    // Height
                    'h-[calc(100vh-3.5rem)]',
                    className
                )}
            >
                {/* Header - mobile only */}
                <div className="flex h-12 items-center justify-between border-b px-4 md:hidden">
                    <span className="font-semibold text-sm">{sidebarTitle}</span>
                    <button
                        type="button"
                        onClick={closeMobile}
                        className="rounded-md p-1.5 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={t('admin-common.aria.closeMenu')}
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* Desktop title */}
                <div className="hidden h-12 items-center border-b px-4 md:flex">
                    <span className="font-semibold text-sm">{sidebarTitle}</span>
                </div>

                {/* Navigation items */}
                <nav
                    className="flex-1 overflow-y-auto p-3"
                    aria-label="Secondary navigation"
                >
                    <div className="space-y-0.5">
                        {filteredItems.map((item) => {
                            if (item.type === 'group') {
                                return (
                                    <SidebarGroup
                                        key={item.id}
                                        item={item}
                                        onItemClick={closeMobile}
                                    />
                                );
                            }
                            return (
                                <SidebarItem
                                    key={item.id}
                                    item={item}
                                    onClick={closeMobile}
                                />
                            );
                        })}
                    </div>
                </nav>
            </aside>
        </>
    );
}

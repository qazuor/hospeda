/**
 * Sidebar Component
 *
 * Contextual sidebar navigation (Level 2).
 * Content is driven by the NEW config-driven IA system (SPEC-154, T-024).
 * Uses `useCurrentSidebar` to resolve the active sidebar and
 * `useVisibleSidebarItems` to filter + annotate items by the current user's
 * permissions.
 *
 * Unread-badge injection: the `conversations-inbox` link item gets a live
 * badge count from `useUnreadCount`, matched by its stable config ID.
 */

import { useSidebarContext } from '@/contexts/sidebar-context';
import { useUnreadCount } from '@/features/conversations/hooks/useUnreadCount';
import { useCurrentSidebar } from '@/hooks/use-current-sidebar';
import { useTranslations } from '@/hooks/use-translations';
import type { VisibleGroupItem, VisibleLinkItem } from '@/hooks/use-visible-sidebar-items';
import { useVisibleSidebarItems } from '@/hooks/use-visible-sidebar-items';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { CloseIcon } from '@repo/icons';
import { SidebarGroup } from './SidebarGroup';
import { SidebarItem } from './SidebarItem';

/** ID of the conversations-inbox link item in the IA config. */
const CONVERSATIONS_INBOX_ITEM_ID = 'conversations-inbox';

export interface SidebarProps {
    /** Additional CSS classes */
    className?: string;
}

/**
 * Inner component — always renders hooks unconditionally.
 * Renders nothing when `sidebar` prop is undefined.
 */
function SidebarInner({
    sidebar,
    className
}: {
    sidebar: ReturnType<typeof useCurrentSidebar>;
    className?: string;
}) {
    const { t } = useTranslations();
    const { isMobileOpen, closeMobile, isCollapsed } = useSidebarContext();

    // Poll unread conversation count for the badge on conversations-inbox.
    const { data: unreadData } = useUnreadCount();
    const unreadCount = unreadData?.count ?? 0;

    // Filter + annotate items via the NEW permission system.
    const rawItems = sidebar?.items ?? [];
    const visibleItems = useVisibleSidebarItems({ items: rawItems });

    if (!sidebar) {
        return null;
    }

    // Inject the unread badge into the conversations-inbox link item.
    const itemsWithBadge = visibleItems.map((item) => {
        if (item.type === 'link' && item.id === CONVERSATIONS_INBOX_ITEM_ID) {
            return { ...(item as VisibleLinkItem), _unreadCount: unreadCount };
        }
        return item;
    });

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
                {/* Mobile header with close button */}
                <div className="flex h-12 items-center justify-between border-b px-4 md:hidden">
                    <span className="font-semibold text-sm">
                        {t('admin-nav.topbar.admin' as TranslationKey)}
                    </span>
                    <button
                        type="button"
                        onClick={closeMobile}
                        className="rounded-md p-1.5 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={t('admin-common.aria.closeMenu' as TranslationKey)}
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* Navigation items */}
                <nav
                    className="flex-1 overflow-y-auto p-3"
                    aria-label="Secondary navigation"
                >
                    <div className="space-y-0.5">
                        {itemsWithBadge.map((item) => {
                            if (item.type === 'separator') {
                                return (
                                    <hr
                                        key={item.id}
                                        className="my-2 border-border/50 border-t"
                                    />
                                );
                            }
                            if (item.type === 'group') {
                                return (
                                    <SidebarGroup
                                        key={item.id}
                                        item={item as VisibleGroupItem}
                                        onItemClick={closeMobile}
                                    />
                                );
                            }
                            // type === 'link'
                            const linkItem = item as VisibleLinkItem & { _unreadCount?: number };
                            return (
                                <SidebarItem
                                    key={item.id}
                                    item={linkItem}
                                    unreadCount={linkItem._unreadCount}
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

/**
 * Sidebar renders the contextual navigation panel for the active section.
 *
 * Renders nothing when no sidebar is configured for the current route.
 * Permissions are resolved via `useVisibleSidebarItems` — items may be
 * visible but `disabled` (greyed-out) when the user lacks access and
 * `onMissing === 'disable'`.
 *
 * The `conversations-inbox` item receives a live unread-message badge
 * injected by ID, preserving the pre-migration behaviour.
 */
export function Sidebar({ className }: SidebarProps) {
    const currentSidebar = useCurrentSidebar();
    return (
        <SidebarInner
            sidebar={currentSidebar}
            className={className}
        />
    );
}

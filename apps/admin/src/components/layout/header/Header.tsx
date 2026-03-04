/**
 * Header Component
 *
 * Main header navigation bar with horizontal section navigation (Level 1).
 * Contains:
 * - Logo/branding
 * - Section navigation (Dashboard, Content, Administration, Analytics)
 * - Search, notifications, and user menu
 * - Mobile hamburger menu
 */

import { CommandPalette } from '@/components/search/CommandPalette';
import { getHeaderNavItems } from '@/config/sections';
import { useSidebarContext } from '@/contexts/sidebar-context';
import { useTranslations } from '@/hooks/use-translations';
import { HeaderUser as ClerkHeader } from '@/integrations/clerk/header-user';
import { useCurrentSectionId } from '@/lib/sections';
import { MenuIcon, NotificationIcon, SettingsIcon, UserIcon } from '@repo/icons';
import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HeaderNavItem } from './HeaderNavItem';
import { MobileMenu } from './MobileMenu';

interface HeaderProps {
    /** User permissions for filtering visible header sections */
    readonly userPermissions?: string[];
}

/**
 * Header renders the main navigation bar.
 * Filters visible sections based on user permissions.
 */
export function Header({ userPermissions }: HeaderProps) {
    const { t } = useTranslations();
    const router = useRouter();
    const { openMobile, closeMobile, isMobileOpen } = useSidebarContext();
    const currentSectionId = useCurrentSectionId();

    // Notifications dropdown state
    const [showNotifications, setShowNotifications] = useState(false);
    const notifRef = useRef<HTMLDivElement | null>(null);

    // Close notifications on navigation
    useEffect(() => {
        const unsub = router.subscribe('onResolved', () => setShowNotifications(false));
        return () => unsub();
    }, [router]);

    // Close notifications on outside click
    useEffect(() => {
        if (!showNotifications) return;
        const onPointerDown = (e: PointerEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        window.addEventListener('pointerdown', onPointerDown, true);
        return () => window.removeEventListener('pointerdown', onPointerDown, true);
    }, [showNotifications]);

    // Filter header nav items by user permissions
    const filteredNavItems = useMemo(
        () => getHeaderNavItems({ userPermissions }),
        [userPermissions]
    );

    // Prepare mobile menu items with active state
    const mobileItems = filteredNavItems.map((item) => ({
        ...item,
        isActive: currentSectionId === item.id
    }));

    return (
        <>
            <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-14 items-center gap-3 px-3 md:px-4">
                    {/* Mobile menu button */}
                    <button
                        type="button"
                        aria-label={t('admin-common.aria.toggleMenu')}
                        className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                        onClick={isMobileOpen ? closeMobile : openMobile}
                    >
                        <MenuIcon className="h-5 w-5" />
                    </button>

                    {/* Logo/Brand */}
                    <Link
                        to="/dashboard"
                        className="flex items-center gap-2 font-semibold text-sm"
                    >
                        <span className="hidden sm:inline">{t('admin-nav.topbar.admin')}</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav
                        className="ml-6 hidden items-center gap-1 md:flex"
                        aria-label="Main navigation"
                    >
                        {filteredNavItems.map((item) => (
                            <HeaderNavItem
                                key={item.id}
                                {...item}
                                isActive={currentSectionId === item.id}
                            />
                        ))}
                    </nav>

                    {/* Right side actions */}
                    <div className="ml-auto flex items-center gap-2">
                        {/* Search command palette */}
                        <CommandPalette />

                        {/* Notifications */}
                        <div
                            ref={notifRef}
                            className="relative"
                            onBlur={(e) => {
                                const next = e.relatedTarget as Node | null;
                                if (notifRef.current && next && notifRef.current.contains(next))
                                    return;
                                setShowNotifications(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') setShowNotifications(false);
                            }}
                        >
                            <button
                                type="button"
                                aria-label={t('admin-common.aria.notifications')}
                                title={t('admin-nav.topbar.notifications')}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                                onClick={() => setShowNotifications((v) => !v)}
                            >
                                <NotificationIcon className="h-5 w-5" />
                            </button>
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 rounded-md border bg-popover p-2 text-sm shadow">
                                    <div className="mb-2 font-semibold">
                                        {t('admin-nav.topbar.notifications')}
                                    </div>
                                    <ul className="space-y-1">
                                        <li className="rounded-md px-2 py-1 hover:bg-accent/50">
                                            {t('admin-common.notifications.noNew')}
                                        </li>
                                    </ul>
                                    <div className="mt-2 border-t pt-2 text-right">
                                        <Link
                                            to="/notifications"
                                            className="underline"
                                            onClick={() => setShowNotifications(false)}
                                        >
                                            {t('admin-common.actions.seeAll')}
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile */}
                        <Link
                            to="/me/profile"
                            aria-label={t('admin-common.aria.profile')}
                            title={t('admin-nav.topbar.profile')}
                            className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                        >
                            <UserIcon className="h-5 w-5" />
                        </Link>

                        {/* Settings */}
                        <Link
                            to="/me/settings"
                            aria-label={t('admin-common.aria.settings')}
                            title={t('admin-nav.topbar.settings')}
                            className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                        >
                            <SettingsIcon className="h-5 w-5" />
                        </Link>

                        {/* Clerk user menu */}
                        <ClerkHeader />
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            <MobileMenu
                isOpen={isMobileOpen}
                onClose={closeMobile}
                items={mobileItems}
            />
        </>
    );
}

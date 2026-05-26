/**
 * Header Component
 *
 * Main header navigation bar (Level 1). Migrated to the NEW config-driven IA
 * system (SPEC-154, T-027).
 *
 * Changes from OLD system:
 * - Desktop nav replaced with `<MainMenu />` (config-driven, permission-aware).
 * - "+" create button replaced with `<QuickCreate />`.
 * - `showSearch` from `useCurrentRoleConfig().topbar` toggles CommandPalette.
 * - OLD `getHeaderNavItems` / `useCurrentSectionId` removed.
 * - Mobile hamburger still triggers sidebar drawer (managed by SidebarContext).
 *   Mobile main-menu navigation is handled by `BottomNav` on mobile devices.
 */

import { CommandPalette } from '@/components/search/CommandPalette';
import { useSidebarContext } from '@/contexts/sidebar-context';
import { useCurrentRoleConfig } from '@/hooks/use-current-role-config';
import { useTranslations } from '@/hooks/use-translations';
import { HeaderUser as AuthHeader } from '@/integrations/clerk/header-user';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { MenuIcon, NotificationIcon, SettingsIcon, UserIcon } from '@repo/icons';
import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { MainMenu } from '../main-menu/MainMenu';
import { QuickCreate } from '../quick-create/QuickCreate';

/**
 * Header renders the main navigation bar for the admin shell.
 *
 * All visibility decisions (which sections to show, whether to show quick-create
 * or search) are driven by the config-driven IA system, never by role checks in
 * this component directly.
 */
export function Header() {
    const { t } = useTranslations();
    const router = useRouter();
    const { openMobile, closeMobile, isMobileOpen } = useSidebarContext();
    const roleConfig = useCurrentRoleConfig();

    // Topbar config from the IA role config.
    const showSearch = roleConfig?.topbar?.showSearch ?? true;

    // Notifications dropdown state.
    const [showNotifications, setShowNotifications] = useState(false);
    const notifRef = useRef<HTMLDivElement | null>(null);

    // Close notifications on navigation.
    useEffect(() => {
        const unsub = router.subscribe('onResolved', () => setShowNotifications(false));
        return () => unsub();
    }, [router]);

    // Close notifications on outside click.
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

    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center gap-3 px-3 md:px-4">
                {/* Mobile menu button — opens sidebar drawer */}
                <button
                    type="button"
                    aria-label={t('admin-common.aria.toggleMenu' as TranslationKey)}
                    className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                    onClick={isMobileOpen ? closeMobile : openMobile}
                >
                    <MenuIcon className="h-5 w-5" />
                </button>

                {/* Logo/Brand */}
                <Link
                    to="/dashboard"
                    aria-label="Hospeda Admin"
                    className="flex items-center gap-2 font-semibold text-sm"
                >
                    <img
                        src="/logo.webp"
                        alt=""
                        aria-hidden="true"
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0"
                    />
                    <span className="hidden font-heading text-base sm:inline">
                        {t('admin-nav.topbar.admin' as TranslationKey)}
                    </span>
                </Link>

                {/* Desktop Navigation — config-driven via MainMenu */}
                <MainMenu />

                {/* Right side actions */}
                <div className={cn('ml-auto flex items-center gap-2')}>
                    {/* Quick-create "+" button — config-driven via QuickCreate */}
                    <QuickCreate />

                    {/* Command Palette search — shown when topbar.showSearch is true */}
                    {showSearch && <CommandPalette />}

                    {/* Notifications */}
                    <div
                        ref={notifRef}
                        className="relative"
                        onBlur={(e) => {
                            const next = e.relatedTarget as Node | null;
                            if (notifRef.current && next && notifRef.current.contains(next)) return;
                            setShowNotifications(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setShowNotifications(false);
                        }}
                    >
                        <button
                            type="button"
                            aria-label={t('admin-common.aria.notifications' as TranslationKey)}
                            title={t('admin-nav.topbar.notifications' as TranslationKey)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                            onClick={() => setShowNotifications((v) => !v)}
                        >
                            <NotificationIcon className="h-5 w-5" />
                        </button>
                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 rounded-md border bg-popover p-2 text-sm shadow">
                                <div className="mb-2 font-semibold">
                                    {t('admin-nav.topbar.notifications' as TranslationKey)}
                                </div>
                                <ul className="space-y-1">
                                    <li className="rounded-md px-2 py-1 hover:bg-accent/50">
                                        {t('admin-common.notifications.noNew' as TranslationKey)}
                                    </li>
                                </ul>
                                <div className="mt-2 border-t pt-2 text-right">
                                    <Link
                                        to="/notifications"
                                        className="underline"
                                        onClick={() => setShowNotifications(false)}
                                    >
                                        {t('admin-common.actions.seeAll' as TranslationKey)}
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile */}
                    <Link
                        to="/me/profile"
                        aria-label={t('admin-common.aria.profile' as TranslationKey)}
                        title={t('admin-nav.topbar.profile' as TranslationKey)}
                        className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                    >
                        <UserIcon className="h-5 w-5" />
                    </Link>

                    {/* Settings */}
                    <Link
                        to="/me/settings"
                        aria-label={t('admin-common.aria.settings' as TranslationKey)}
                        title={t('admin-nav.topbar.settings' as TranslationKey)}
                        className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                    >
                        <SettingsIcon className="h-5 w-5" />
                    </Link>

                    {/* Auth user menu */}
                    <AuthHeader />
                </div>
            </div>
        </header>
    );
}

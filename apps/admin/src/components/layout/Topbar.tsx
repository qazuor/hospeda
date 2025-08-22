import { useTranslations } from '@/hooks/use-translations';
import ClerkHeader from '@/integrations/clerk/header-user';
import { menuTree } from '@/lib/menu';
import {
    AccommodationIcon,
    AdminIcon,
    AnalyticsIcon,
    ContentIcon,
    DashboardIcon,
    EventIcon,
    MapIcon,
    MenuIcon,
    NotificationIcon,
    PostIcon,
    PostSponsorIcon,
    SearchIcon,
    SectionIcon,
    SettingsIcon,
    UserIcon,
    UsersIcon
} from '@repo/icons';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

export type TopbarProps = {
    /**
     * Called when the mobile menu button is pressed to toggle the sidebar.
     */
    readonly onToggleSidebar: () => void;
};

/**
 * Topbar renders the fixed header for the admin panel including the menu
 * toggle on mobile, brand link, a placeholder for search and the user area.
 */
export const Topbar = ({ onToggleSidebar }: TopbarProps) => {
    const { location } = useRouterState();
    const router = useRouter();
    const { t } = useTranslations();
    const sectionIcon = useMemo(() => {
        const top = (() => {
            const direct = menuTree.find((it) => it.to === location.pathname);
            if (direct) return direct.title;
            for (const it of menuTree) {
                if (it.children?.some((c) => c.to === location.pathname)) return it.title;
            }
            return undefined;
        })();
        const iconProps = { className: 'h-5 w-5' };
        switch (top) {
            case 'Dashboard':
                return <DashboardIcon {...iconProps} />;
            case 'Contenido':
                return <ContentIcon {...iconProps} />;
            case 'Alojamientos':
                return <AccommodationIcon {...iconProps} />;
            case 'Destinos':
                return <MapIcon {...iconProps} />;
            case 'Eventos':
                return <EventIcon {...iconProps} />;
            case 'Publicaciones':
                return <PostIcon {...iconProps} />;
            case 'Users':
                return <UsersIcon {...iconProps} />;
            case 'Admin':
                return <AdminIcon {...iconProps} />;
            case 'Sponsors':
                return <PostSponsorIcon {...iconProps} />;
            case 'Analiticas':
                return <AnalyticsIcon {...iconProps} />;
            default:
                return <SectionIcon {...iconProps} />;
        }
    }, [location]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notifRef = useRef<HTMLDivElement | null>(null);

    // Close on any router state change (navigation)
    useEffect(() => {
        const unsub = router.subscribe('onResolved', () => setShowNotifications(false));
        return () => unsub();
    }, [router]);

    // Close on outside click
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
                <button
                    aria-label={t('admin-common.aria.toggleMenu')}
                    className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                    type="button"
                    onClick={onToggleSidebar}
                >
                    <MenuIcon className="h-5 w-5" />
                </button>

                <Link
                    to="/"
                    className="flex items-center gap-2 font-semibold text-sm"
                >
                    {sectionIcon}
                    <span className="hidden sm:inline">{t('admin-nav.topbar.admin')}</span>
                </Link>

                <div className="ml-auto flex items-center gap-2">
                    <div className="hidden items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-muted-foreground text-sm sm:flex">
                        <SearchIcon className="h-4 w-4" />
                        <span>Search…</span>
                    </div>
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
                            aria-label={t('admin-common.aria.notifications')}
                            title={t('admin-nav.topbar.notifications')}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                            onClick={() => setShowNotifications((v) => !v)}
                        >
                            <NotificationIcon className="h-5 w-5" />
                        </button>
                        {showNotifications ? (
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
                                        See all
                                    </Link>
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <Link
                        to="/me/profile"
                        aria-label={t('admin-common.aria.profile')}
                        title={t('admin-nav.topbar.profile')}
                        className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                    >
                        <UserIcon className="h-5 w-5" />
                    </Link>
                    <Link
                        to="/me/settings"
                        aria-label={t('admin-common.aria.settings')}
                        title={t('admin-nav.topbar.settings')}
                        className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                    >
                        <SettingsIcon className="h-5 w-5" />
                    </Link>
                    <ClerkHeader />
                </div>
            </div>
        </header>
    );
};

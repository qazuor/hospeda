import ClerkHeader from '@/integrations/clerk/header-user';
import { menuTree } from '@/lib/menu';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import {
    BarChart3,
    Bell,
    Building2,
    CalendarDays,
    FileText,
    FolderKanban,
    Handshake,
    LayoutDashboard,
    MapPin,
    Menu,
    PanelsTopLeft,
    Search,
    Settings,
    Shield,
    User,
    Users
} from 'lucide-react';
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
    const sectionIcon = useMemo(() => {
        const top = (() => {
            const direct = menuTree.find((it) => it.to === location.href);
            if (direct) return direct.title;
            for (const it of menuTree) {
                if (it.children?.some((c) => c.to === location.href)) return it.title;
            }
            return undefined;
        })();
        const iconProps = { className: 'h-5 w-5' };
        switch (top) {
            case 'Dashboard':
                return <LayoutDashboard {...iconProps} />;
            case 'Contenido':
                return <FolderKanban {...iconProps} />;
            case 'Alojamientos':
                return <Building2 {...iconProps} />;
            case 'Destinos':
                return <MapPin {...iconProps} />;
            case 'Eventos':
                return <CalendarDays {...iconProps} />;
            case 'Publicaciones':
                return <FileText {...iconProps} />;
            case 'Users':
                return <Users {...iconProps} />;
            case 'Admin':
                return <Shield {...iconProps} />;
            case 'Sponsors':
                return <Handshake {...iconProps} />;
            case 'Analiticas':
                return <BarChart3 {...iconProps} />;
            default:
                return <PanelsTopLeft {...iconProps} />;
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
                    aria-label="Toggle menu"
                    className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                    type="button"
                    onClick={onToggleSidebar}
                >
                    <Menu className="h-5 w-5" />
                </button>

                <Link
                    to="/"
                    className="flex items-center gap-2 font-semibold text-sm"
                >
                    {sectionIcon}
                    <span className="hidden sm:inline">Admin</span>
                </Link>

                <div className="ml-auto flex items-center gap-2">
                    <div className="hidden items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-muted-foreground text-sm sm:flex">
                        <Search className="h-4 w-4" />
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
                            aria-label="Notifications"
                            title="Notifications"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                            onClick={() => setShowNotifications((v) => !v)}
                        >
                            <Bell className="h-5 w-5" />
                        </button>
                        {showNotifications ? (
                            <div className="absolute right-0 mt-2 w-80 rounded-md border bg-popover p-2 text-sm shadow">
                                <div className="mb-2 font-semibold">Notifications</div>
                                <ul className="space-y-1">
                                    <li className="rounded-md px-2 py-1 hover:bg-accent/50">
                                        No new notifications
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
                        aria-label="Profile"
                        title="Profile"
                        className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                    >
                        <User className="h-5 w-5" />
                    </Link>
                    <Link
                        to="/me/settings"
                        aria-label="Settings"
                        title="Settings"
                        className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                    >
                        <Settings className="h-5 w-5" />
                    </Link>
                    <ClerkHeader />
                </div>
            </div>
        </header>
    );
};

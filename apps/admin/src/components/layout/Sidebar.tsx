import { useTranslations } from '@/hooks/use-translations';
import type { PermissionValue } from '@/lib/menu';
import { filterMenuByPermissions, menuTree } from '@/lib/menu';
import { cn } from '@/lib/utils';
import {
    AccommodationIcon,
    AddIcon,
    AdminIcon,
    AnalyticsIcon,
    CloseIcon,
    ContentIcon,
    DashboardIcon,
    DebugIcon,
    EventIcon,
    ListIcon,
    MapIcon,
    PostIcon,
    PostSponsorIcon,
    SearchIcon,
    SettingsIcon,
    TagIcon,
    UsersIcon
} from '@repo/icons';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

export type SidebarProps = {
    /**
     * Whether the sidebar drawer is visible on small screens.
     */
    readonly open: boolean;
    /**
     * Called to close the sidebar (used by overlay and close button).
     */
    readonly onClose: () => void;
};

// Navigation items are driven by permissions from menuTree

/**
 * Sidebar renders the primary navigation. On desktop it is a static column.
 * On mobile it slides in as a drawer.
 */
export const Sidebar = ({ open, onClose }: SidebarProps) => {
    const { location } = useRouterState();
    const router = useRouter();
    const { t } = useTranslations();
    // TODO: Replace with real user permissions from Clerk session/ctx
    const userPermissions: PermissionValue[] | undefined = undefined;
    const items = filterMenuByPermissions(menuTree, userPermissions);

    const getIcon = (title: string) => {
        switch (title) {
            case 'Dashboard':
                return <DashboardIcon className="h-5 w-5" />;
            case 'Contenido':
                return <ContentIcon className="h-5 w-5" />;
            case 'Alojamientos':
                return <AccommodationIcon className="h-5 w-5" />;
            case 'Destinos':
                return <MapIcon className="h-5 w-5" />;
            case 'Eventos':
                return <EventIcon className="h-5 w-5" />;
            case 'Publicaciones':
                return <PostIcon className="h-5 w-5" />;
            case 'Users':
                return <UsersIcon className="h-5 w-5" />;
            case 'Admin':
                return <AdminIcon className="h-5 w-5" />;
            case 'Sponsors':
                return <PostSponsorIcon className="h-5 w-5" />;
            case 'Analiticas':
                return <AnalyticsIcon className="h-5 w-5" />;
            // Profile/Settings moved to header
            default:
                return <ContentIcon className="h-5 w-5" />;
        }
    };

    const getChildIcon = (parent: string, child: string) => {
        const childLower = child.toLowerCase();
        if (/(agregar|new|create)/.test(childLower)) return <AddIcon className="h-4 w-4" />;
        if (/(lista|list|all)/.test(childLower)) return <ListIcon className="h-4 w-4" />;
        if (parent === 'Contenido') {
            if (/amenit/.test(childLower)) return <SettingsIcon className="h-4 w-4" />;
            if (/feature/.test(childLower)) return <ContentIcon className="h-4 w-4" />;
            if (/attraction/.test(childLower)) return <TagIcon className="h-4 w-4" />;
        }
        if (parent === 'Alojamientos') return <AccommodationIcon className="h-4 w-4" />;
        if (parent === 'Destinos') return <MapIcon className="h-4 w-4" />;
        if (parent === 'Eventos') {
            if (/organizer/.test(childLower)) return <UsersIcon className="h-4 w-4" />;
            if (/location/.test(childLower)) return <MapIcon className="h-4 w-4" />;
            return <EventIcon className="h-4 w-4" />;
        }
        if (parent === 'Publicaciones') return <PostIcon className="h-4 w-4" />;
        if (parent === 'Users')
            return /agregar|new|create/.test(childLower) ? (
                <AddIcon className="h-4 w-4" />
            ) : (
                <UsersIcon className="h-4 w-4" />
            );
        if (parent === 'Admin') {
            if (/permiso/.test(childLower)) return <AdminIcon className="h-4 w-4" />;
            if (/tag/.test(childLower)) return <TagIcon className="h-4 w-4" />;
            if (/seo/.test(childLower)) return <SearchIcon className="h-4 w-4" />;
            if (/portal|setting/.test(childLower)) return <SettingsIcon className="h-4 w-4" />;
        }
        if (parent === 'Analiticas') {
            if (/debug/.test(childLower)) return <DebugIcon className="h-4 w-4" />;
            return <AnalyticsIcon className="h-4 w-4" />;
        }
        if (parent === 'Sponsors') return <PostSponsorIcon className="h-4 w-4" />;
        return <ContentIcon className="h-4 w-4" />;
    };

    const headerRoutes = ['/me/profile', '/me/settings', '/notifications'] as const;
    const isHeaderRoute = useMemo(
        () => headerRoutes.some((r) => location.href.startsWith(r)),
        [location.href, headerRoutes]
    );

    const selectedTopFromLocation = useMemo(() => {
        if (isHeaderRoute) return undefined;
        const path = location.href;
        const direct = items.find((it) => it.to && it.to === path);
        if (direct) return direct.title;
        for (const it of items) {
            if (it.children) {
                const child = it.children.find((c) => c.to === path);
                if (child) return it.title;
            }
        }
        return items[0]?.title;
    }, [items, location.href, isHeaderRoute]);

    const [selectedTitle, setSelectedTitle] = useState<string | undefined>(selectedTopFromLocation);
    const [hoveredTitle, setHoveredTitle] = useState<string | undefined>(undefined);
    useEffect(() => {
        setSelectedTitle(selectedTopFromLocation);
    }, [selectedTopFromLocation]);

    const selectedItem = useMemo(() => {
        if (!selectedTitle) return undefined;
        return items.find((i) => i.title === selectedTitle);
    }, [items, selectedTitle]);
    const viewedItem = useMemo(() => {
        const effectiveTitle = hoveredTitle ?? selectedTitle;
        if (!effectiveTitle) return undefined;
        return items.find((i) => i.title === effectiveTitle);
    }, [items, hoveredTitle, selectedTitle]);
    const showSubPanel = Boolean(
        viewedItem?.children && viewedItem.children.length > 0 && (hoveredTitle || !isHeaderRoute)
    );
    return (
        <aside
            className={cn(
                '-translate-x-full fixed top-14 right-auto bottom-0 left-0 z-40 w-64 border-r bg-sidebar text-sidebar-foreground transition-transform md:sticky md:top-14 md:min-h-[calc(100vh-3.5rem)] md:translate-x-0',
                !showSubPanel && 'md:w-14',
                isHeaderRoute && 'md:absolute',
                open && 'translate-x-0'
            )}
            aria-label="Primary"
        >
            <div className="flex h-14 items-center justify-between px-3 md:hidden">
                <span className="font-semibold text-sm">{t('admin-nav.sidebar.navigation')}</span>
                <button
                    aria-label={t('admin-common.aria.closeMenu')}
                    className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                    onClick={onClose}
                >
                    <CloseIcon className="h-5 w-5" />
                </button>
            </div>

            <div
                className="flex h-full"
                onMouseLeave={() => setHoveredTitle(undefined)}
            >
                {/* Primary icon rail */}
                <div className="flex h-full w-14 flex-col items-stretch border-r">
                    {items.map((item) => {
                        const isSelected = selectedItem ? item.title === selectedItem.title : false;
                        const hasChildren = Boolean(item.children && item.children.length > 0);
                        const handleClick = () => {
                            if (hasChildren) {
                                setSelectedTitle(item.title);
                            } else if (item.to) {
                                router.navigate({ to: item.to });
                                onClose();
                            }
                        };
                        return (
                            <button
                                key={item.title}
                                type="button"
                                onClick={handleClick}
                                onMouseEnter={() => setHoveredTitle(item.title)}
                                onFocus={() => setHoveredTitle(item.title)}
                                aria-label={item.title}
                                title={item.title}
                                className={cn(
                                    'm-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl ring-1 ring-transparent transition hover:ring-2 hover:ring-accent/70 hover:ring-offset-2 hover:ring-offset-sidebar',
                                    isSelected &&
                                        'scale-110 bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-500 text-white shadow-2xl shadow-fuchsia-500/40 ring-4 ring-fuchsia-400/50 ring-offset-2 ring-offset-sidebar'
                                )}
                            >
                                {getIcon(item.title)}
                            </button>
                        );
                    })}
                </div>

                {/* Secondary panel */}
                {showSubPanel ? (
                    <div className="w-64 p-2">
                        {viewedItem ? (
                            <>
                                <div className="px-2 py-2 font-semibold text-sm">
                                    {viewedItem.title}
                                </div>
                                <div className="space-y-1">
                                    {viewedItem.children?.map((child) => {
                                        if (!child.to) return null;
                                        const isActive = location.href === child.to;
                                        return (
                                            <Link
                                                key={child.to}
                                                to={child.to}
                                                className={cn(
                                                    'block rounded-md px-3 py-2 transition hover:bg-accent/30 hover:text-accent-foreground/90',
                                                    isActive &&
                                                        'border-fuchsia-400 border-l-4 bg-gradient-to-r from-fuchsia-600 to-indigo-600 font-semibold text-white shadow-md ring-2 ring-fuchsia-400/60 ring-offset-2 ring-offset-sidebar'
                                                )}
                                                onClick={onClose}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    {getChildIcon(viewedItem.title, child.title)}
                                                    {child.title}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </aside>
    );
};

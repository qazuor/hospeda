/**
 * Dashboard Section Configuration
 *
 * Routes: /dashboard, /me/*, /notifications
 */

import { createSection, sidebar } from '@/lib/sections';
import {
    AccommodationIcon,
    DashboardIcon,
    NotificationIcon,
    SettingsIcon,
    UserIcon
} from '@repo/icons';

export const dashboardSection = createSection({
    id: 'dashboard',
    label: 'Dashboard',
    labelKey: 'admin-menu.dashboard',
    icon: <DashboardIcon className="h-5 w-5" />,
    routes: ['/dashboard', '/dashboard/**', '/me/**', '/notifications'],
    defaultRoute: '/dashboard',
    permissions: [],
    sidebar: {
        title: 'Dashboard',
        titleKey: 'admin-menu.dashboard',
        items: [
            sidebar.link(
                'overview',
                'Resumen',
                '/dashboard',
                <DashboardIcon className="h-4 w-4" />
            ),
            sidebar.link(
                'my-accommodations',
                'Mis Alojamientos',
                '/me/accommodations',
                <AccommodationIcon className="h-4 w-4" />
            ),
            sidebar.separator(),
            sidebar.link(
                'notifications',
                'Notificaciones',
                '/notifications',
                <NotificationIcon className="h-4 w-4" />
            ),
            sidebar.link('profile', 'Mi Perfil', '/me/profile', <UserIcon className="h-4 w-4" />),
            sidebar.link(
                'settings',
                'Configuración',
                '/me/settings',
                <SettingsIcon className="h-4 w-4" />
            )
        ]
    }
});

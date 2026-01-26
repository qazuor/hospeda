/**
 * Administration Section Configuration
 *
 * Routes: /access/*, /amenities/*, /features/*, /sponsors/*, /event-locations/*,
 *         /event-organizers/*, /settings/*
 */

import { createSection, sidebar } from '@/lib/sections';
import {
    AdminIcon,
    ContentIcon,
    EventLocationIcon,
    EventOrganizerIcon,
    ListIcon,
    PermissionsIcon,
    PostSponsorIcon,
    RolesIcon,
    SearchIcon,
    SettingsIcon,
    TagsIcon,
    UsersManagementIcon
} from '@repo/icons';

export const administrationSection = createSection({
    id: 'administration',
    label: 'Administración',
    labelKey: 'admin-menu.admin.title',
    icon: <AdminIcon className="h-5 w-5" />,
    routes: [
        '/access/**',
        '/amenities',
        '/amenities/**',
        '/features',
        '/features/**',
        '/sponsors',
        '/sponsors/**',
        '/event-locations',
        '/event-locations/**',
        '/event-organizers',
        '/event-organizers/**',
        '/settings/**',
        '/content/**'
    ],
    defaultRoute: '/access/users',
    sidebar: {
        title: 'Administración',
        titleKey: 'admin-menu.admin.title',
        items: [
            sidebar.group(
                'access',
                'Control de Acceso',
                [
                    sidebar.link(
                        'users',
                        'Usuarios',
                        '/access/users',
                        <UsersManagementIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'roles',
                        'Roles',
                        '/access/roles',
                        <RolesIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'permissions',
                        'Permisos',
                        '/access/permissions',
                        <PermissionsIcon className="h-4 w-4" />
                    )
                ],
                <AdminIcon className="h-4 w-4" />,
                true // expanded by default
            ),
            sidebar.separator(),
            sidebar.group(
                'catalog',
                'Catálogos',
                [
                    sidebar.link(
                        'amenities',
                        'Amenidades',
                        '/content/accommodation-amenities',
                        <SettingsIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'features',
                        'Características',
                        '/content/accommodation-features',
                        <ContentIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'attractions',
                        'Atracciones de Destino',
                        '/content/destination-attractions',
                        <ListIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'tags',
                        'Etiquetas',
                        '/settings/tags',
                        <TagsIcon className="h-4 w-4" />
                    )
                ],
                <TagsIcon className="h-4 w-4" />
            ),
            sidebar.group(
                'events-admin',
                'Gestión de Eventos',
                [
                    sidebar.link(
                        'locations',
                        'Ubicaciones',
                        '/events/locations',
                        <EventLocationIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'organizers',
                        'Organizadores',
                        '/events/organizers',
                        <EventOrganizerIcon className="h-4 w-4" />
                    )
                ],
                <EventLocationIcon className="h-4 w-4" />
            ),
            sidebar.separator(),
            sidebar.link(
                'sponsors',
                'Patrocinadores',
                '/sponsors',
                <PostSponsorIcon className="h-4 w-4" />
            ),
            sidebar.group(
                'settings',
                'Configuración',
                [
                    sidebar.link('seo', 'SEO', '/settings/seo', <SearchIcon className="h-4 w-4" />),
                    sidebar.link(
                        'critical',
                        'Configuración Crítica',
                        '/settings/critical',
                        <SettingsIcon className="h-4 w-4" />
                    )
                ],
                <SettingsIcon className="h-4 w-4" />
            )
        ]
    }
});

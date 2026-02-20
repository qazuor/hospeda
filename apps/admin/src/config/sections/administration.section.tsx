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
import { PermissionEnum } from '@repo/schemas';

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
                        <UsersManagementIcon className="h-4 w-4" />,
                        [PermissionEnum.USER_CREATE, PermissionEnum.USER_DELETE]
                    ),
                    sidebar.link(
                        'roles',
                        'Roles',
                        '/access/roles',
                        <RolesIcon className="h-4 w-4" />,
                        [PermissionEnum.ACCESS_PERMISSIONS_MANAGE]
                    ),
                    sidebar.link(
                        'permissions',
                        'Permisos',
                        '/access/permissions',
                        <PermissionsIcon className="h-4 w-4" />,
                        [PermissionEnum.ACCESS_PERMISSIONS_MANAGE, PermissionEnum.PERMISSION_VIEW]
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
                        <SettingsIcon className="h-4 w-4" />,
                        [PermissionEnum.AMENITY_CREATE]
                    ),
                    sidebar.link(
                        'features',
                        'Características',
                        '/content/accommodation-features',
                        <ContentIcon className="h-4 w-4" />,
                        [PermissionEnum.FEATURE_CREATE]
                    ),
                    sidebar.link(
                        'attractions',
                        'Atracciones de Destino',
                        '/content/destination-attractions',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.ATTRACTION_VIEW, PermissionEnum.ATTRACTION_CREATE]
                    ),
                    sidebar.link(
                        'tags',
                        'Etiquetas',
                        '/settings/tags',
                        <TagsIcon className="h-4 w-4" />,
                        [PermissionEnum.TAG_CREATE]
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
                        <EventLocationIcon className="h-4 w-4" />,
                        [PermissionEnum.EVENT_LOCATION_VIEW, PermissionEnum.EVENT_LOCATION_CREATE]
                    ),
                    sidebar.link(
                        'organizers',
                        'Organizadores',
                        '/events/organizers',
                        <EventOrganizerIcon className="h-4 w-4" />,
                        [PermissionEnum.EVENT_ORGANIZER_VIEW, PermissionEnum.EVENT_ORGANIZER_CREATE]
                    )
                ],
                <EventLocationIcon className="h-4 w-4" />
            ),
            sidebar.separator(),
            sidebar.link(
                'sponsors',
                'Patrocinadores',
                '/sponsors',
                <PostSponsorIcon className="h-4 w-4" />,
                [PermissionEnum.POST_SPONSOR_VIEW, PermissionEnum.POST_SPONSOR_CREATE]
            ),
            sidebar.group(
                'settings',
                'Configuración',
                [
                    sidebar.link(
                        'seo',
                        'SEO',
                        '/settings/seo',
                        <SearchIcon className="h-4 w-4" />,
                        [PermissionEnum.SEO_MANAGE]
                    ),
                    sidebar.link(
                        'critical',
                        'Configuración Crítica',
                        '/settings/critical',
                        <SettingsIcon className="h-4 w-4" />,
                        [PermissionEnum.ACCESS_PANEL_ADMIN]
                    )
                ],
                <SettingsIcon className="h-4 w-4" />
            )
        ]
    }
});

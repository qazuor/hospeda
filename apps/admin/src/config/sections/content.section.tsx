/**
 * Content Section Configuration
 *
 * Routes: /accommodations/*, /destinations/*, /posts/*, /events/*,
 *         /content/destination-attractions/*, /content/accommodation-amenities/*,
 *         /content/accommodation-features/*
 */

import { createSection, sidebar } from '@/lib/sections';
import {
    AccommodationIcon,
    AddIcon,
    CheckCircleIcon,
    ContentIcon,
    DestinationIcon,
    EventIcon,
    ListIcon,
    MapIcon,
    PostIcon,
    WifiIcon
} from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';

export const contentSection = createSection({
    id: 'content',
    label: 'Contenido',
    labelKey: 'admin-menu.content.title',
    icon: <ContentIcon className="h-5 w-5" />,
    routes: [
        '/accommodations',
        '/accommodations/**',
        '/destinations',
        '/destinations/**',
        '/posts',
        '/posts/**',
        '/events',
        '/events/**',
        '/content/destination-attractions',
        '/content/destination-attractions/**',
        '/content/accommodation-amenities',
        '/content/accommodation-amenities/**',
        '/content/accommodation-features',
        '/content/accommodation-features/**'
    ],
    defaultRoute: '/accommodations',
    sidebar: {
        title: 'Contenido',
        titleKey: 'admin-menu.content.title',
        items: [
            sidebar.group(
                'accommodations',
                'Alojamientos',
                [
                    sidebar.link(
                        'accommodations-list',
                        'Listado',
                        '/accommodations',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.ACCOMMODATION_VIEW_ALL]
                    ),
                    sidebar.link(
                        'accommodations-new',
                        'Crear Nuevo',
                        '/accommodations/new',
                        <AddIcon className="h-4 w-4" />,
                        [PermissionEnum.ACCOMMODATION_CREATE]
                    )
                ],
                <AccommodationIcon className="h-4 w-4" />,
                true // expanded by default
            ),
            sidebar.group(
                'destinations',
                'Destinos',
                [
                    sidebar.link(
                        'destinations-list',
                        'Listado',
                        '/destinations',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.DESTINATION_VIEW_ALL]
                    ),
                    sidebar.link(
                        'destinations-new',
                        'Crear Nuevo',
                        '/destinations/new',
                        <AddIcon className="h-4 w-4" />,
                        [PermissionEnum.DESTINATION_CREATE]
                    )
                ],
                <DestinationIcon className="h-4 w-4" />
            ),
            sidebar.group(
                'attractions',
                'Atracciones',
                [
                    sidebar.link(
                        'attractions-list',
                        'Listado',
                        '/content/destination-attractions',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.ATTRACTION_VIEW]
                    ),
                    sidebar.link(
                        'attractions-new',
                        'Crear Nueva',
                        '/content/destination-attractions/new',
                        <AddIcon className="h-4 w-4" />,
                        [PermissionEnum.ATTRACTION_CREATE]
                    )
                ],
                <MapIcon className="h-4 w-4" />
            ),
            sidebar.group(
                'amenities',
                'Amenidades',
                [
                    sidebar.link(
                        'amenities-list',
                        'Listado',
                        '/content/accommodation-amenities',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.AMENITY_VIEW]
                    ),
                    sidebar.link(
                        'amenities-new',
                        'Crear Nueva',
                        '/content/accommodation-amenities/new',
                        <AddIcon className="h-4 w-4" />,
                        [PermissionEnum.AMENITY_CREATE]
                    )
                ],
                <WifiIcon className="h-4 w-4" />
            ),
            sidebar.group(
                'features',
                'Características',
                [
                    sidebar.link(
                        'features-list',
                        'Listado',
                        '/content/accommodation-features',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.FEATURE_VIEW]
                    ),
                    sidebar.link(
                        'features-new',
                        'Crear Nueva',
                        '/content/accommodation-features/new',
                        <AddIcon className="h-4 w-4" />,
                        [PermissionEnum.FEATURE_CREATE]
                    )
                ],
                <CheckCircleIcon className="h-4 w-4" />
            ),
            sidebar.separator(),
            sidebar.group(
                'posts',
                'Blog',
                [
                    sidebar.link(
                        'posts-list',
                        'Publicaciones',
                        '/posts',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.POST_VIEW_ALL]
                    ),
                    sidebar.link(
                        'posts-new',
                        'Nueva Publicación',
                        '/posts/new',
                        <AddIcon className="h-4 w-4" />,
                        [PermissionEnum.POST_CREATE]
                    )
                ],
                <PostIcon className="h-4 w-4" />
            ),
            sidebar.group(
                'events',
                'Eventos',
                [
                    sidebar.link(
                        'events-list',
                        'Listado',
                        '/events',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.EVENT_VIEW_ALL]
                    ),
                    sidebar.link(
                        'events-new',
                        'Crear Evento',
                        '/events/new',
                        <AddIcon className="h-4 w-4" />,
                        [PermissionEnum.EVENT_CREATE]
                    )
                ],
                <EventIcon className="h-4 w-4" />
            )
        ]
    }
});

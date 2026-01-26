/**
 * Content Section Configuration
 *
 * Routes: /accommodations/*, /destinations/*, /posts/*, /events/*, /attractions/*
 */

import { createSection, sidebar } from '@/lib/sections';
import {
    AccommodationIcon,
    AddIcon,
    ContentIcon,
    DestinationIcon,
    EventIcon,
    ListIcon,
    MapIcon,
    PostIcon
} from '@repo/icons';

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
        '/attractions',
        '/attractions/**'
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
                        <ListIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'accommodations-new',
                        'Crear Nuevo',
                        '/accommodations/new',
                        <AddIcon className="h-4 w-4" />
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
                        <ListIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'destinations-new',
                        'Crear Nuevo',
                        '/destinations/new',
                        <AddIcon className="h-4 w-4" />
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
                        '/attractions',
                        <ListIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'attractions-new',
                        'Crear Nueva',
                        '/attractions/new',
                        <AddIcon className="h-4 w-4" />
                    )
                ],
                <MapIcon className="h-4 w-4" />
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
                        <ListIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'posts-new',
                        'Nueva Publicación',
                        '/posts/new',
                        <AddIcon className="h-4 w-4" />
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
                        <ListIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'events-new',
                        'Crear Evento',
                        '/events/new',
                        <AddIcon className="h-4 w-4" />
                    )
                ],
                <EventIcon className="h-4 w-4" />
            )
        ]
    }
});

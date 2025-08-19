import { PermissionEnum } from '@repo/types';
import type { ReactNode } from 'react';

export type MenuItem = {
    /** Visible label in the sidebar */
    readonly title: string;
    /** Route path starting with '/' */
    readonly to?: string;
    /** Icon element (lucide-react) */
    readonly icon?: ReactNode;
    /** Permission or list of permissions required */
    readonly permission?: PermissionEnum | readonly PermissionEnum[];
    /** Nested children */
    readonly children?: readonly MenuItem[];
};

export type CanAccessOptions = {
    /** When true, user must have ALL permissions. When false, ANY matches. */
    readonly requireAll?: boolean;
};

export type PermissionValue = PermissionEnum;

export const canAccess = (
    userPermissions: readonly PermissionEnum[] | undefined,
    required?: PermissionEnum | readonly PermissionEnum[],
    options?: CanAccessOptions
): boolean => {
    if (!required) return true;
    // In absence of a user permission list, default to visible (development fallback)
    if (!userPermissions || userPermissions.length === 0) return true;
    const list = Array.isArray(required) ? required : [required];
    if (options?.requireAll) {
        return list.every((p) => userPermissions.includes(p));
    }
    return list.some((p) => userPermissions.includes(p));
};

export const filterMenuByPermissions = (
    items: readonly MenuItem[],
    userPermissions: readonly PermissionEnum[] | undefined
): MenuItem[] => {
    return items
        .map((item) => {
            const allowed = canAccess(userPermissions, item.permission);
            if (!allowed) return null;
            const children = item.children
                ? filterMenuByPermissions(item.children, userPermissions)
                : undefined;
            return { ...item, children };
        })
        .filter(Boolean) as MenuItem[];
};

// TODO: Wire icons in Sidebar to keep this file headless (no JSX icons here)
export const menuTree: readonly MenuItem[] = [
    {
        title: 'Dashboard',
        to: '/dashboard',
        permission: [PermissionEnum.DASHBOARD_BASE_VIEW, PermissionEnum.DASHBOARD_FULL_VIEW]
    },
    {
        title: 'Contenido',
        children: [
            {
                title: 'Destination Attractions',
                to: '/content/destination-attractions',
                permission: PermissionEnum.DESTINATION_ATTRACTION_MANAGE
            },
            {
                title: 'Accommodation Amenities',
                to: '/content/accommodation-amenities',
                permission: [
                    PermissionEnum.AMENITY_CREATE,
                    PermissionEnum.AMENITY_UPDATE,
                    PermissionEnum.AMENITY_DELETE
                ]
            },
            {
                title: 'Accommodation Features',
                to: '/content/accommodation-features',
                permission: [
                    PermissionEnum.FEATURE_CREATE,
                    PermissionEnum.FEATURE_UPDATE,
                    PermissionEnum.FEATURE_DELETE
                ]
            }
        ]
    },
    {
        title: 'Alojamientos',
        children: [
            {
                title: 'Agregar',
                to: '/accommodations/new',
                permission: PermissionEnum.ACCOMMODATION_CREATE
            },
            {
                title: 'Lista',
                to: '/accommodations',
                permission: PermissionEnum.ACCOMMODATION_VIEW_ALL
            },
            {
                title: 'Mis alojamientos',
                to: '/me/accommodations',
                permission: [
                    PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN
                ]
            }
        ]
    },
    {
        title: 'Destinos',
        children: [
            {
                title: 'Agregar',
                to: '/destinations/new',
                permission: PermissionEnum.DESTINATION_CREATE
            },
            {
                title: 'Lista',
                to: '/destinations',
                permission: PermissionEnum.DESTINATION_VIEW_ALL
            }
        ]
    },
    {
        title: 'Eventos',
        children: [
            {
                title: 'Agregar',
                to: '/events/new',
                permission: PermissionEnum.EVENT_CREATE
            },
            {
                title: 'Lista',
                to: '/events',
                permission: PermissionEnum.EVENT_VIEW_ALL
            },
            {
                title: 'Organizer',
                to: '/events/organizers',
                permission: PermissionEnum.EVENT_ORGANIZER_MANAGE
            },
            {
                title: 'Locations',
                to: '/events/locations',
                permission: PermissionEnum.EVENT_LOCATION_MANAGE
            }
        ]
    },
    {
        title: 'Publicaciones',
        children: [
            {
                title: 'Agregar',
                to: '/posts/new',
                permission: PermissionEnum.POST_CREATE
            },
            {
                title: 'Lista',
                to: '/posts',
                permission: PermissionEnum.POST_VIEW_ALL
            }
        ]
    },
    {
        title: 'Users',
        children: [
            {
                title: 'Agregar',
                to: '/access/users/new',
                permission: PermissionEnum.USER_CREATE
            },
            {
                title: 'Lista',
                to: '/access/users',
                permission: PermissionEnum.USER_READ_ALL
            }
        ]
    },
    {
        title: 'Admin',
        children: [
            {
                title: 'Permisos',
                to: '/access/permissions',
                permission: PermissionEnum.ACCESS_PERMISSIONS_MANAGE
            },
            {
                title: 'Tags',
                to: '/settings/tags',
                permission: [
                    PermissionEnum.TAG_CREATE,
                    PermissionEnum.TAG_UPDATE,
                    PermissionEnum.TAG_DELETE
                ]
            },
            {
                title: 'SEO',
                to: '/settings/seo',
                permission: PermissionEnum.SEO_MANAGE
            },
            {
                title: 'Portal Settings',
                to: '/settings/critical',
                permission: PermissionEnum.SETTINGS_MANAGE
            }
        ]
    },
    {
        title: 'Sponsors',
        to: '/sponsors',
        permission: [PermissionEnum.POST_SPONSOR_MANAGE, PermissionEnum.POST_SPONSORSHIP_MANAGE]
    },
    {
        title: 'Analiticas',
        children: [
            {
                title: 'de uso',
                to: '/analytics/usage',
                permission: PermissionEnum.ANALYTICS_VIEW
            },
            {
                title: 'debug',
                to: '/analytics/debug',
                permission: [PermissionEnum.LOGS_VIEW_ALL, PermissionEnum.ERRORS_VIEW]
            },
            {
                title: 'de negocio',
                to: '/analytics/business',
                permission: PermissionEnum.STATS_VIEW
            }
        ]
    }
];

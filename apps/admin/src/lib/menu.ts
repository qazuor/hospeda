import { PermissionEnum } from '@repo/schemas';
import type { ReactNode } from 'react';

export type MenuItem = {
    /** i18n key for the menu item label (use with t() function) */
    readonly titleKey: string;
    /** Route path starting with '/' */
    readonly to?: string;
    /** Icon element (@repo/icons) */
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

// Menu items use i18n keys - translate with t(item.titleKey) in components
export const menuTree: readonly MenuItem[] = [
    {
        titleKey: 'admin-menu.dashboard',
        to: '/dashboard',
        permission: [PermissionEnum.DASHBOARD_BASE_VIEW, PermissionEnum.DASHBOARD_FULL_VIEW]
    },
    {
        titleKey: 'admin-menu.content.title',
        children: [
            {
                titleKey: 'admin-menu.content.destinationAttractions',
                to: '/content/destination-attractions',
                permission: PermissionEnum.DESTINATION_ATTRACTION_MANAGE
            },
            {
                titleKey: 'admin-menu.content.accommodationAmenities',
                to: '/content/accommodation-amenities',
                permission: [
                    PermissionEnum.AMENITY_CREATE,
                    PermissionEnum.AMENITY_UPDATE,
                    PermissionEnum.AMENITY_DELETE
                ]
            },
            {
                titleKey: 'admin-menu.content.accommodationFeatures',
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
        titleKey: 'admin-menu.accommodations.title',
        children: [
            {
                titleKey: 'admin-menu.accommodations.add',
                to: '/accommodations/new',
                permission: PermissionEnum.ACCOMMODATION_CREATE
            },
            {
                titleKey: 'admin-menu.accommodations.list',
                to: '/accommodations',
                permission: PermissionEnum.ACCOMMODATION_VIEW_ALL
            },
            {
                titleKey: 'admin-menu.accommodations.myAccommodations',
                to: '/me/accommodations',
                permission: [
                    PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN
                ]
            }
        ]
    },
    {
        titleKey: 'admin-menu.destinations.title',
        children: [
            {
                titleKey: 'admin-menu.destinations.add',
                to: '/destinations/new',
                permission: PermissionEnum.DESTINATION_CREATE
            },
            {
                titleKey: 'admin-menu.destinations.list',
                to: '/destinations',
                permission: PermissionEnum.DESTINATION_VIEW_ALL
            }
        ]
    },
    {
        titleKey: 'admin-menu.events.title',
        children: [
            {
                titleKey: 'admin-menu.events.add',
                to: '/events/new',
                permission: PermissionEnum.EVENT_CREATE
            },
            {
                titleKey: 'admin-menu.events.list',
                to: '/events',
                permission: PermissionEnum.EVENT_VIEW_ALL
            },
            {
                titleKey: 'admin-menu.events.organizers',
                to: '/events/organizers',
                permission: PermissionEnum.EVENT_ORGANIZER_MANAGE
            },
            {
                titleKey: 'admin-menu.events.locations',
                to: '/events/locations',
                permission: PermissionEnum.EVENT_LOCATION_MANAGE
            }
        ]
    },
    {
        titleKey: 'admin-menu.posts.title',
        children: [
            {
                titleKey: 'admin-menu.posts.add',
                to: '/posts/new',
                permission: PermissionEnum.POST_CREATE
            },
            {
                titleKey: 'admin-menu.posts.list',
                to: '/posts',
                permission: PermissionEnum.POST_VIEW_ALL
            }
        ]
    },
    {
        titleKey: 'admin-menu.users.title',
        children: [
            {
                titleKey: 'admin-menu.users.add',
                to: '/access/users/new',
                permission: PermissionEnum.USER_CREATE
            },
            {
                titleKey: 'admin-menu.users.list',
                to: '/access/users',
                permission: PermissionEnum.USER_READ_ALL
            }
        ]
    },
    {
        titleKey: 'admin-menu.admin.title',
        children: [
            {
                titleKey: 'admin-menu.admin.permissions',
                to: '/access/permissions',
                permission: PermissionEnum.ACCESS_PERMISSIONS_MANAGE
            },
            {
                titleKey: 'admin-menu.admin.tags',
                to: '/settings/tags',
                permission: [
                    PermissionEnum.TAG_CREATE,
                    PermissionEnum.TAG_UPDATE,
                    PermissionEnum.TAG_DELETE
                ]
            },
            {
                titleKey: 'admin-menu.admin.seo',
                to: '/settings/seo',
                permission: PermissionEnum.SEO_MANAGE
            },
            {
                titleKey: 'admin-menu.admin.portalSettings',
                to: '/settings/critical',
                permission: PermissionEnum.SETTINGS_MANAGE
            }
        ]
    },
    {
        titleKey: 'admin-menu.sponsors',
        to: '/sponsors',
        permission: [PermissionEnum.POST_SPONSOR_MANAGE, PermissionEnum.POST_SPONSORSHIP_MANAGE]
    },
    {
        titleKey: 'admin-menu.analytics.title',
        children: [
            {
                titleKey: 'admin-menu.analytics.usage',
                to: '/analytics/usage',
                permission: PermissionEnum.ANALYTICS_VIEW
            },
            {
                titleKey: 'admin-menu.analytics.debug',
                to: '/analytics/debug',
                permission: [PermissionEnum.LOGS_VIEW_ALL, PermissionEnum.ERRORS_VIEW]
            },
            {
                titleKey: 'admin-menu.analytics.business',
                to: '/analytics/business',
                permission: PermissionEnum.STATS_VIEW
            }
        ]
    }
];

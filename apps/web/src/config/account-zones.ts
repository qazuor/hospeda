/**
 * @file account-zones.ts
 * @description The two zones of Mi cuenta (HOS-2551, owner decisions of 22/11).
 *
 * - The PERSONAL zone covers `/mi-cuenta/`, the profile pages and the former
 *   tourist pages. Its sidebar shows «Inicio», «Mi perfil» and «Mis viajes».
 * - The BUSINESS zone covers the host, comercio, editorial, partner and
 *   provider pages. Its sidebar shows «← Mi cuenta» and the business verticals
 *   the person has.
 *
 * The header user menu lists one «Administrar …» shortcut per business vertical
 * ({@link BUSINESS_SHORTCUTS}). The same catalog answers whether a person is a
 * real client (has at least one vertical), which gates «Asistentes de IA».
 *
 * Labels are i18n keys and icons are `@repo/icons` references, like
 * `navigation.ts`.
 *
 * @module config/account-zones
 */

import type { IconProps } from '@repo/icons';
import { BuildingIcon, CompassIcon, PostIcon, StarIcon, VenueIcon, WrenchIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import type { ComponentType } from 'react';
import { AI_ASSISTANTS_NAV_ITEM_ID, type NavGroup } from '@/config/navigation';

/** Id of the personal «Inicio» group (holds the `/mi-cuenta/` link). */
export const HOME_GROUP_ID = 'inicio';

/** Id of the personal «Mi perfil» group. */
export const PROFILE_GROUP_ID = 'perfil';

/** Id of the header-less group holding the interim personal entries. */
export const INTERIM_GROUP_ID = 'extras';

/** Id of the partner business group. */
export const PARTNER_GROUP_ID = 'partner';

/** The «Mi perfil» entries, in display order. All belong to the `cuenta` group. */
export const PROFILE_NAV_ITEM_IDS = [
    'editProfile',
    'subscription',
    'preferences',
    'newsletter',
    AI_ASSISTANTS_NAV_ITEM_ID
] as const;

/**
 * Personal entries the sidebar still lists after «Mis viajes». HOS-2550 moves
 * «Qué hay de nuevo» and «Ayuda» to header icons; until then the sidebar is
 * the only link to `/mi-cuenta/novedades` and `/mi-cuenta/ayuda`.
 */
export const INTERIM_PERSONAL_NAV_ITEM_IDS = ['whatsNew', 'help'] as const;

/**
 * The business groups, in display order (Alojamientos, Comer y salir +
 * Experiencias, Editorial, Partner, Proveedor). `comercio` covers both venue
 * and experience owners until HOS-2559 splits the page.
 */
export const BUSINESS_GROUP_IDS = [
    'anfitrion',
    'comercio',
    'editorial',
    PARTNER_GROUP_ID,
    'proveedor'
] as const;

/**
 * The partner self-service entry (`/mi-cuenta/partner`). Like the provider
 * group, an approved partner holds no permission and no role (HOS-278 AC-7):
 * ownership of the `partners` row is the gate, so it is spliced in by the
 * caller from an `ownsPartner` fact, never through `requiredPermission`.
 */
export const PARTNER_NAV_GROUP: NavGroup = {
    id: PARTNER_GROUP_ID,
    i18nKey: 'account.nav.groupPartner',
    suppressHeaderWhenSingle: true,
    items: [
        {
            id: 'partner',
            i18nKey: 'account.nav.partner',
            href: 'mi-cuenta/partner',
            icon: StarIcon,
            surfaces: ['sidebar', 'mobile']
        }
    ]
};

/** Row ownership that grants a business vertical without a permission. */
export type BusinessOwnership = 'hostTradeListing' | 'partner';

/** One destination of a shortcut; the first visible one wins. */
export interface BusinessShortcutTarget {
    /** Path segment under the locale (e.g. `mi-cuenta/publicaciones`). */
    readonly href: string;
    /** Permission this destination needs, on top of the shortcut's own gate. */
    readonly requiredPermission?: PermissionEnum;
}

/** One «Administrar …» shortcut of the header user menu. */
export interface BusinessShortcut {
    /** Stable id. */
    readonly id: 'accommodations' | 'venues' | 'experiences' | 'editorial' | 'partner' | 'provider';
    /** i18n key of the label (always phrased as managing). */
    readonly i18nKey: string;
    /** Icon. */
    readonly icon: ComponentType<IconProps>;
    /** Gate by permission (same declarations the sidebar groups use). */
    readonly requiredPermission?: PermissionEnum;
    /** Gate by any of these permissions. */
    readonly requiredPermissions?: readonly PermissionEnum[];
    /** Gate by row ownership instead of a permission. */
    readonly ownership?: BusinessOwnership;
    /** Destinations, in priority order. */
    readonly targets: readonly BusinessShortcutTarget[];
}

/**
 * The business shortcuts, in the owner's order. Each one is gated exactly like
 * the sidebar entry it opens:
 *
 * - Alojamientos: the `anfitrion` group (`ACCOMMODATION_CREATE`).
 * - Comer y salir / Experiencias: the two permissions the `comercio` group
 *   accepts, one each. Both open `/mi-cuenta/comercio` until HOS-2559.
 * - Editorial: the `editorial` items. It opens «Mis publicaciones», or «Mis
 *   eventos» for an account that can only create events.
 * - Partner / Proveedor: row ownership.
 */
export const BUSINESS_SHORTCUTS: readonly BusinessShortcut[] = [
    {
        id: 'accommodations',
        i18nKey: 'account.nav.manageAccommodations',
        icon: BuildingIcon,
        requiredPermission: PermissionEnum.ACCOMMODATION_CREATE,
        targets: [{ href: 'mi-cuenta/host-dashboard' }]
    },
    {
        id: 'venues',
        i18nKey: 'account.nav.manageVenues',
        icon: VenueIcon,
        requiredPermission: PermissionEnum.VENUE_EDIT_OWN,
        targets: [{ href: 'mi-cuenta/comercio' }]
    },
    {
        id: 'experiences',
        i18nKey: 'account.nav.manageExperiences',
        icon: CompassIcon,
        requiredPermission: PermissionEnum.EXPERIENCE_EDIT_OWN,
        targets: [{ href: 'mi-cuenta/comercio' }]
    },
    {
        id: 'editorial',
        i18nKey: 'account.nav.manageEditorial',
        icon: PostIcon,
        requiredPermissions: [PermissionEnum.POST_CREATE, PermissionEnum.EVENT_CREATE],
        targets: [
            { href: 'mi-cuenta/publicaciones', requiredPermission: PermissionEnum.POST_CREATE },
            { href: 'mi-cuenta/eventos', requiredPermission: PermissionEnum.EVENT_CREATE }
        ]
    },
    {
        id: 'partner',
        i18nKey: 'account.nav.managePartner',
        icon: StarIcon,
        ownership: 'partner',
        targets: [{ href: 'mi-cuenta/partner' }]
    },
    {
        id: 'provider',
        i18nKey: 'account.nav.manageProvider',
        icon: WrenchIcon,
        ownership: 'hostTradeListing',
        targets: [{ href: 'mi-cuenta/proveedor' }]
    }
];

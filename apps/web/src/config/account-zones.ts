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
 * ({@link BUSINESS_SHORTCUTS}). Who has a vertical, and therefore who is a real
 * client (gates «Asistentes de IA»), is `BUSINESS_VERTICAL_GATES` in
 * `@repo/schemas` (HOS-2562), shared with the API.
 *
 * Labels are i18n keys and icons are `@repo/icons` references, like
 * `navigation.ts`.
 *
 * @module config/account-zones
 */

import type { IconProps } from '@repo/icons';
import { BuildingIcon, CompassIcon, PostIcon, StarIcon, VenueIcon, WrenchIcon } from '@repo/icons';
import { type BusinessVerticalId, PermissionEnum } from '@repo/schemas';
import type { ComponentType } from 'react';
import { AI_ASSISTANTS_NAV_ITEM_ID, type NavGroup } from '@/config/navigation';

/** Id of the personal «Inicio» group (holds the `/mi-cuenta/` link). */
export const HOME_GROUP_ID = 'inicio';

/** Id of the personal «Mi perfil» group. */
export const PROFILE_GROUP_ID = 'perfil';

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

/** One destination of a shortcut; the first visible one wins. */
export interface BusinessShortcutTarget {
    /** Path segment under the locale (e.g. `mi-cuenta/publicaciones`). */
    readonly href: string;
    /** Permission this destination needs, on top of the vertical's own gate. */
    readonly requiredPermission?: PermissionEnum;
}

/**
 * One «Administrar …» shortcut of the header user menu. Its id IS the business
 * vertical it opens; who has that vertical is decided by
 * `BUSINESS_VERTICAL_GATES` in `@repo/schemas` (HOS-2562), the same rule the
 * API applies, never here.
 */
export interface BusinessShortcut {
    /** The business vertical (also the shortcut's stable id). */
    readonly id: BusinessVerticalId;
    /** i18n key of the label (always phrased as managing). */
    readonly i18nKey: string;
    /** Icon. */
    readonly icon: ComponentType<IconProps>;
    /** Destinations, in priority order. */
    readonly targets: readonly BusinessShortcutTarget[];
}

/**
 * The business shortcuts, in the owner's order (the same order as
 * `BUSINESS_VERTICAL_IDS`):
 *
 * - Alojamientos: the `anfitrion` area.
 * - Comer y salir / Experiencias: both open `/mi-cuenta/comercio` until HOS-2559.
 * - Editorial: «Mis publicaciones», or «Mis eventos» for an account that can
 *   only create events.
 * - Partner / Proveedor: their self-service pages.
 */
export const BUSINESS_SHORTCUTS: readonly BusinessShortcut[] = [
    {
        id: 'accommodations',
        i18nKey: 'account.nav.manageAccommodations',
        icon: BuildingIcon,
        targets: [{ href: 'mi-cuenta/host-dashboard' }]
    },
    {
        id: 'venues',
        i18nKey: 'account.nav.manageVenues',
        icon: VenueIcon,
        targets: [{ href: 'mi-cuenta/comercio' }]
    },
    {
        id: 'experiences',
        i18nKey: 'account.nav.manageExperiences',
        icon: CompassIcon,
        targets: [{ href: 'mi-cuenta/comercio' }]
    },
    {
        id: 'editorial',
        i18nKey: 'account.nav.manageEditorial',
        icon: PostIcon,
        targets: [
            { href: 'mi-cuenta/publicaciones', requiredPermission: PermissionEnum.POST_CREATE },
            { href: 'mi-cuenta/eventos', requiredPermission: PermissionEnum.EVENT_CREATE }
        ]
    },
    {
        id: 'partner',
        i18nKey: 'account.nav.managePartner',
        icon: StarIcon,
        targets: [{ href: 'mi-cuenta/partner' }]
    },
    {
        id: 'provider',
        i18nKey: 'account.nav.manageProvider',
        icon: WrenchIcon,
        targets: [{ href: 'mi-cuenta/proveedor' }]
    }
];

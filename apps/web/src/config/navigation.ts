/**
 * @file navigation.ts
 * @description Single source of truth for the `/mi-cuenta/*` account navigation
 * (HOS-131 G-3). Replaces the three divergent menu definitions that used to live
 * in `AccountLayout.astro` (sidebar), `UserMenu.client.tsx` (avatar dropdown), and
 * `MobileMenu.client.tsx` (hamburguesa) — every surface now renders a subset of
 * `ACCOUNT_NAV_GROUPS` via `getNavForSurface`.
 *
 * Gating (HOS-131 D-4): each group/item declares its own `requiredPermission`
 * (`PermissionEnum`) as the single source of gating semantics. Evaluation is
 * asymmetric by surface — see `src/lib/nav-gating.ts` for the two evaluators
 * (`isVisibleByPermissions` for client surfaces, `isVisibleByRole` for the
 * server-rendered sidebar) that consume these declarations.
 *
 * Labels are stored as i18n **keys** (not resolved text) — surfaces resolve
 * them via `t()` at render time. Icons are `@repo/icons` component references,
 * not strings, mirroring the convention in `src/config/tours.ts`.
 */

import type { IconProps } from '@repo/icons';
import {
    AlertsIcon,
    BriefcaseIcon,
    BuildingIcon,
    ChatIcon,
    CompassIcon,
    CreditCardIcon,
    DashboardIcon,
    FavoriteIcon,
    HomeIcon,
    MegaphoneIcon,
    NewsletterIcon,
    OffersIcon,
    SearchIcon,
    SettingsIcon,
    SparkleIcon,
    StarIcon,
    UserIcon,
    WrenchIcon
} from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import type { ComponentType } from 'react';

/**
 * The three surfaces that can render a subset of the account navigation:
 * - `sidebar` — desktop `/mi-cuenta/*` sidebar (`AccountLayout.astro`, SSR).
 * - `avatar` — the header avatar dropdown (`UserMenu.client.tsx`, curated subset).
 * - `mobile` — the hamburguesa account accordion (`MobileMenu.client.tsx`).
 */
export type NavSurface = 'sidebar' | 'avatar' | 'mobile';

/**
 * A single navigation entry (a link) inside a `NavGroup`.
 */
export interface NavItem {
    /** Stable identifier, used for active-state matching and test selectors. */
    readonly id: string;
    /** i18n key resolved by each surface via `t()`. Never resolved text. */
    readonly i18nKey: string;
    /** Path segment relative to the locale prefix (e.g. `mi-cuenta/editar`). */
    readonly href: string;
    /** `@repo/icons` component reference (not a string). */
    readonly icon: ComponentType<IconProps>;
    /**
     * Gating declaration (HOS-131 D-4). Omitted means "always visible" —
     * evaluated by `isVisibleByPermissions` / `isVisibleByRole`.
     */
    readonly requiredPermission?: PermissionEnum;
    /** Which surfaces render this item. */
    readonly surfaces: readonly NavSurface[];
    /** `data-tour` target id for the welcome tour (`src/config/tours.ts`), if any. */
    readonly tourTarget?: string;
}

/**
 * A named group of `NavItem`s (renders as a sidebar section, an accordion
 * panel, etc., depending on the surface).
 */
export interface NavGroup {
    /** Stable identifier. */
    readonly id: string;
    /** i18n key for the group label, resolved by each surface via `t()`. */
    readonly i18nKey: string;
    /**
     * Gating declaration for the whole group (HOS-131 D-4). Omitted means
     * "always visible" (e.g. the `cuenta` and `turista` groups).
     */
    readonly requiredPermission?: PermissionEnum;
    /**
     * When `true`, surfaces should render this group's single item without a
     * group header (used for the `comercio` "cajón" group per spec §6.1).
     */
    readonly suppressHeaderWhenSingle?: boolean;
    readonly items: readonly NavItem[];
}

/**
 * A single acquirable option inside a `DiscoveryDoor` hub page.
 */
export interface DiscoveryDoorOption {
    /** Stable identifier. */
    readonly id: string;
    /** i18n key for the option label/description. */
    readonly i18nKey: string;
    /** Path segment for the option's CTA (acquire flow or "Gestionar" link). */
    readonly href: string;
}

/**
 * A discovery door (spec §6.2/§6.3): a CTA that leads to an internal hub page
 * listing acquirable verticals/roles ("Publicá en Hospeda" / "Sumate como
 * aliado"). Lives outside the management groups — never mixed into them.
 */
export interface DiscoveryDoor {
    /** Stable identifier. */
    readonly id: string;
    /** i18n key for the door's CTA label. */
    readonly i18nKey: string;
    /** `listing` = list-on-hospeda verticals; `partner` = B2B alliance roles. */
    readonly kind: 'listing' | 'partner';
    /** Path segment for the hub page. */
    readonly href: string;
    /** Acquirable options shown on the hub page. */
    readonly options: readonly DiscoveryDoorOption[];
}

/**
 * Both desktop surfaces (`sidebar`, `mobile`) render the full navigation
 * today — only the `avatar` dropdown curates a subset (spec §6.4), which is
 * populated in a later HOS-131 task once `UserMenu.client.tsx` is rewritten.
 */
const FULL_SURFACES: readonly NavSurface[] = ['sidebar', 'mobile'];

/**
 * Single source of truth for the `/mi-cuenta/*` navigation, grouped per the
 * hybrid-by-roles IA (HOS-131 spec §6.1). Consumed exclusively through
 * `getNavForSurface` — never iterate this constant directly from a component.
 */
export const ACCOUNT_NAV_GROUPS: readonly NavGroup[] = [
    {
        id: 'cuenta',
        i18nKey: 'account.nav.groupAccount',
        items: [
            {
                id: 'dashboard',
                i18nKey: 'account.nav.dashboard',
                href: 'mi-cuenta',
                icon: HomeIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'editProfile',
                i18nKey: 'account.nav.editProfile',
                href: 'mi-cuenta/editar',
                icon: UserIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'profile'
            },
            {
                id: 'subscription',
                i18nKey: 'account.nav.subscription',
                href: 'mi-cuenta/suscripcion',
                icon: CreditCardIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'preferences',
                i18nKey: 'account.nav.preferences',
                href: 'mi-cuenta/preferencias',
                icon: SettingsIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'newsletter',
                i18nKey: 'account.nav.newsletter',
                href: 'mi-cuenta/newsletter',
                icon: NewsletterIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'whatsNew',
                i18nKey: 'account.nav.whatsNew',
                href: 'mi-cuenta/novedades',
                icon: SparkleIcon,
                surfaces: FULL_SURFACES
            }
        ]
    },
    {
        id: 'turista',
        i18nKey: 'account.nav.groupTourist',
        items: [
            {
                id: 'favorites',
                i18nKey: 'account.nav.favorites',
                href: 'mi-cuenta/favoritos',
                icon: FavoriteIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'searchHistory',
                i18nKey: 'account.nav.searchHistory',
                href: 'mi-cuenta/historial-busquedas',
                icon: SearchIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'alerts',
                i18nKey: 'account.nav.alerts',
                href: 'mi-cuenta/alertas',
                icon: AlertsIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'exclusiveDeals',
                i18nKey: 'account.nav.exclusiveDeals',
                href: 'mi-cuenta/ofertas-exclusivas',
                icon: OffersIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'recommendations',
                i18nKey: 'account.pages.dashboard.nav.recommendations',
                href: 'mi-cuenta/recomendaciones',
                icon: CompassIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'reviews',
                i18nKey: 'account.nav.reviews',
                href: 'mi-cuenta/resenas',
                icon: StarIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'inbox',
                i18nKey: 'conversations.inbox.guestInboxTitle',
                href: 'mi-cuenta/consultas',
                icon: ChatIcon,
                surfaces: FULL_SURFACES
            }
        ]
    },
    {
        id: 'anfitrion',
        i18nKey: 'account.nav.groupHost',
        requiredPermission: PermissionEnum.ACCOMMODATION_CREATE,
        items: [
            {
                id: 'hostDashboard',
                i18nKey: 'account.nav.hostDashboard',
                href: 'mi-cuenta/host-dashboard',
                icon: DashboardIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'host-dashboard'
            },
            {
                id: 'properties',
                i18nKey: 'account.nav.properties',
                href: 'mi-cuenta/propiedades',
                icon: BuildingIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'properties'
            },
            {
                id: 'ownerMessages',
                i18nKey: 'conversations.inbox.ownerInboxTitle',
                href: 'mi-cuenta/consultas-propietario',
                icon: ChatIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'messages'
            },
            {
                id: 'promotions',
                i18nKey: 'account.nav.promotions',
                href: 'mi-cuenta/promociones',
                icon: MegaphoneIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'promotions'
            },
            {
                id: 'providerDirectory',
                i18nKey: 'account.nav.tradeDirectory',
                href: 'mi-cuenta/directorio-proveedores',
                icon: WrenchIcon,
                surfaces: FULL_SURFACES
            }
        ]
    },
    {
        id: 'comercio',
        i18nKey: 'account.nav.groupCommerce',
        requiredPermission: PermissionEnum.COMMERCE_EDIT_OWN,
        suppressHeaderWhenSingle: true,
        items: [
            {
                id: 'commerce',
                i18nKey: 'commerce.owner.nav',
                href: 'mi-cuenta/comercio',
                icon: BriefcaseIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'commerce'
            }
        ]
    }
    // TODO(HOS-131 T-011): Aliados group + discovery doors — pending OQ-1/OQ-3.
    // The "Aliados"/"Partners"/"Parceiros" cajón group (sponsor, service
    // provider, ...) and the two DiscoveryDoor entries ("Publicá en Hospeda",
    // "Sumate como aliado") are added once their hub-page routes (OQ-1) and
    // per-user "acquired vertical" signal (OQ-3) are decided. Do not invent
    // sponsor/provider PermissionEnum values ahead of that decision.
];

/**
 * Discovery doors (spec §6.2/§6.3). Intentionally empty until HOS-131 T-011
 * resolves OQ-1 (hub page routes) and OQ-3 (acquired-vertical signal) — see
 * the TODO above `ACCOUNT_NAV_GROUPS`.
 */
export const ACCOUNT_DISCOVERY_DOORS: readonly DiscoveryDoor[] = [];

/**
 * A predicate that decides whether a gated node (a `NavGroup` or `NavItem`)
 * should be visible, given its `requiredPermission` declaration. Implemented
 * by `isVisibleByPermissions` and `isVisibleByRole` in `src/lib/nav-gating.ts`.
 */
export type NavVisibilityPredicate = (node: {
    readonly requiredPermission?: PermissionEnum;
}) => boolean;

/** Input for `getNavForSurface`. */
export interface GetNavForSurfaceParams {
    /** Which surface is rendering (filters items by `NavItem.surfaces`). */
    readonly surface: NavSurface;
    /**
     * Gating predicate — pass `isVisibleByPermissions(permissions)` on client
     * surfaces or `isVisibleByRole(role)` on the server-rendered sidebar.
     */
    readonly visibility: NavVisibilityPredicate;
}

/** Output of `getNavForSurface`. */
export interface GetNavForSurfaceResult {
    /** Visible groups for the requested surface, with items pre-filtered. */
    readonly groups: readonly NavGroup[];
}

/**
 * Selects the subset of `ACCOUNT_NAV_GROUPS` visible on a given surface.
 *
 * A group is included only if it passes `visibility` AND has at least one
 * item that (a) is registered for `surface` and (b) also passes `visibility`.
 * Groups/items with no `requiredPermission` are always visible.
 *
 * @param params - `{ surface, visibility }` (RO-RO).
 * @returns `{ groups }` — the filtered, surface-scoped navigation groups.
 */
export function getNavForSurface({
    surface,
    visibility
}: GetNavForSurfaceParams): GetNavForSurfaceResult {
    const groups = ACCOUNT_NAV_GROUPS.filter((group) => visibility(group))
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.surfaces.includes(surface) && visibility(item))
        }))
        .filter((group) => group.items.length > 0);

    return { groups };
}

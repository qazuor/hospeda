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
 * identical across surfaces: `isVisibleByPermissions` evaluates effective
 * permissions for both SSR and client navigation.
 *
 * Labels are stored as i18n **keys** (not resolved text) — surfaces resolve
 * them via `t()` at render time. Icons are `@repo/icons` component references,
 * not strings, mirroring the convention in `src/config/tours.ts`.
 */

import type { IconProps } from '@repo/icons';
import {
    AlertsIcon,
    AskToAiIcon,
    BuildingIcon,
    ChatIcon,
    CompassIcon,
    CreditCardIcon,
    DashboardIcon,
    EventIcon,
    FaqsIcon,
    FavoriteIcon,
    HomeIcon,
    MegaphoneIcon,
    NewsletterIcon,
    OffersIcon,
    PackageIcon,
    PostIcon,
    ReceiptIcon,
    SearchIcon,
    SettingsIcon,
    SparkleIcon,
    StarIcon,
    UserIcon,
    VenueIcon,
    WrenchIcon
} from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import type { ComponentType } from 'react';
import { PUBLISHER_ACCESS } from '@/lib/account/publisher-access';
import { OWNER_LIST_LABEL_KEYS, ownerListPath } from '@/lib/listing/owner-list-vertical';
import { AI_ASSISTANTS_PATH } from '@/lib/routes';

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
     * evaluated by `isVisibleByPermissions` on every surface.
     */
    readonly requiredPermission?: PermissionEnum;
    /** Any one of these permissions makes this navigation node visible. */
    readonly requiredPermissions?: readonly PermissionEnum[];
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
    /** Any one of these permissions makes this navigation node visible. */
    readonly requiredPermissions?: readonly PermissionEnum[];
    /**
     * When `true`, surfaces should render this group's single item without a
     * group header (a single-item "cajón" group, spec §6.1).
     */
    readonly suppressHeaderWhenSingle?: boolean;
    readonly items: readonly NavItem[];
}

/**
 * Both desktop surfaces (`sidebar`, `mobile`) render the full navigation.
 * The `avatar` dropdown curates a subset (spec §6.4) — only `dashboard`,
 * `favorites`, and `subscription` opt into it via `CURATED_SURFACES` below.
 * HOS-2551: the avatar menu now reads only `dashboard` from that subset; its
 * «Administrar …» shortcuts come from `BUSINESS_SHORTCUTS`
 * (`src/config/account-zones.ts`) through `getCuratedAccountNav`.
 */
/** Id of the AI assistants nav item, which the sidebar gates on the MCP feature. */
export const AI_ASSISTANTS_NAV_ITEM_ID = 'aiAssistants';

/** Id of the «Comer y salir» business area (HOS-2559). */
export const VENUE_LISTINGS_GROUP_ID = 'comercio-venue';

/** Id of the «Experiencias» business area (HOS-2559). */
export const EXPERIENCE_LISTINGS_GROUP_ID = 'comercio-experience';

/** Id of the `/mi-cuenta/` entry: the account home (HOS-2551). */
export const DASHBOARD_NAV_ITEM_ID = 'dashboard';

const FULL_SURFACES: readonly NavSurface[] = ['sidebar', 'mobile'];

/**
 * Surface set for the always-curated avatar/mobile items (`dashboard`,
 * `favorites`, `subscription` — HOS-131 §6.4/§6.5). Adds `avatar` on top of
 * `FULL_SURFACES` so `getNavForSurface({ surface: 'avatar' })` returns them.
 */
const CURATED_SURFACES: readonly NavSurface[] = [...FULL_SURFACES, 'avatar'];

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
                id: DASHBOARD_NAV_ITEM_ID,
                i18nKey: 'account.nav.dashboard',
                href: 'mi-cuenta',
                icon: HomeIcon,
                surfaces: CURATED_SURFACES
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
                surfaces: CURATED_SURFACES
            },
            {
                // HOS-2485 (AC-8): the add-ons page highlights its own item.
                id: 'addons',
                i18nKey: 'account.nav.addons',
                href: 'mi-cuenta/complementos',
                icon: PackageIcon,
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
            },
            {
                // HOS-2410 web-ui §5. No `requiredPermission`: provider and
                // partner status is row-based, so the server cannot gate it. A
                // tourist who opens it lands on a page that says who it is for.
                id: 'help',
                i18nKey: 'account.nav.help',
                href: 'mi-cuenta/ayuda',
                icon: FaqsIcon,
                surfaces: FULL_SURFACES
            },
            {
                // HOS-2184 T-028. Gated, not always shown: with the MCP feature on
                // it is shown to everyone, with it off only to users who still have
                // connections. HOS-2551: only the sidebar renders it, and only for
                // a real client (an account with a business vertical); the avatar
                // and mobile menus no longer list it.
                id: AI_ASSISTANTS_NAV_ITEM_ID,
                i18nKey: 'account.nav.aiAssistants',
                href: AI_ASSISTANTS_PATH,
                icon: AskToAiIcon,
                surfaces: ['sidebar']
            }
        ]
    },
    {
        id: 'anfitrion',
        i18nKey: 'account.nav.groupHost',
        items: [
            {
                id: 'hostDashboard',
                ...PUBLISHER_ACCESS.host,
                i18nKey: 'account.nav.hostDashboard',
                href: 'mi-cuenta/host-dashboard',
                icon: DashboardIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'host-dashboard'
            },
            {
                id: 'properties',
                ...PUBLISHER_ACCESS.host,
                i18nKey: 'account.nav.properties',
                href: 'mi-cuenta/propiedades',
                icon: BuildingIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'properties'
            },
            {
                id: 'ownerMessages',
                ...PUBLISHER_ACCESS.inbox,
                i18nKey: 'conversations.inbox.ownerInboxTitle',
                href: 'mi-cuenta/consultas-propietario',
                icon: ChatIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'messages'
            },
            {
                id: 'promotions',
                ...PUBLISHER_ACCESS.promotions,
                i18nKey: 'account.nav.promotions',
                href: 'mi-cuenta/promociones',
                icon: MegaphoneIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'promotions'
            },
            {
                id: 'providerDirectory',
                ...PUBLISHER_ACCESS.directory,
                i18nKey: 'account.nav.tradeDirectory',
                href: 'mi-cuenta/directorio-proveedores',
                icon: WrenchIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'benefitUsages',
                ...PUBLISHER_ACCESS.host,
                i18nKey: 'account.nav.benefitUsages',
                href: 'mi-cuenta/usos-de-beneficio',
                icon: ReceiptIcon,
                surfaces: FULL_SURFACES
            }
        ]
    },
    // HOS-2559: «Comer y salir» and «Experiencias» are two areas, each over
    // its own list (`/mi-cuenta/comercio/?vertical=…`, see
    // `lib/listing/owner-list-vertical.ts`). Each is gated by its own vertical
    // permission, so a person with one of the two verticals sees only that one.
    {
        id: VENUE_LISTINGS_GROUP_ID,
        i18nKey: 'account.nav.groupVenues',
        ...PUBLISHER_ACCESS.venue,
        items: [
            {
                // HOS-2475: the venue owner dashboard, mirroring `hostDashboard`.
                id: 'venueDashboard',
                i18nKey: 'account.nav.venueDashboard',
                href: 'mi-cuenta/tablero-locales',
                icon: DashboardIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'venue-listings',
                i18nKey: OWNER_LIST_LABEL_KEYS.venue,
                href: ownerListPath({ vertical: 'venue' }),
                icon: VenueIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'comercio-listings-venue'
            }
        ]
    },
    {
        id: EXPERIENCE_LISTINGS_GROUP_ID,
        i18nKey: 'account.nav.groupExperiences',
        ...PUBLISHER_ACCESS.experience,
        items: [
            {
                // HOS-2476: the experience owner dashboard.
                id: 'experienceDashboard',
                i18nKey: 'account.nav.experienceDashboard',
                href: 'mi-cuenta/tablero-experiencias',
                icon: DashboardIcon,
                surfaces: FULL_SURFACES
            },
            {
                id: 'experience-listings',
                i18nKey: OWNER_LIST_LABEL_KEYS.experience,
                href: ownerListPath({ vertical: 'experience' }),
                icon: CompassIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'comercio-listings-experience'
            }
        ]
    },
    {
        // The editor's own area (HOS-374 Phase 2). The pages under
        // `/mi-cuenta/publicaciones` and `/mi-cuenta/eventos` shipped with their
        // gates already wired (`hasPostsNavAccess` / `hasEventsNavAccess`), but
        // nothing ever linked to them — an editor could only reach their own
        // content by typing the URL.
        //
        // Unlike every other group here, this one declares NO group-level
        // `requiredPermission`, on purpose. Posts and events are separate
        // content domains with separate permissions server-side (see the
        // operation-specific publisher policies). Gating the group on
        // either one would hide the other's item the day they do. Instead each
        // item carries its own gate and `getNavForSurface` drops the group when
        // both fall away — so a role holding only one of the two still gets the
        // half it is entitled to.
        id: 'editorial',
        i18nKey: 'account.nav.groupEditorial',
        items: [
            {
                id: 'myPosts',
                i18nKey: 'account.nav.myPosts',
                href: 'mi-cuenta/publicaciones',
                icon: PostIcon,
                ...PUBLISHER_ACCESS.posts,
                surfaces: FULL_SURFACES,
                tourTarget: 'my-posts'
            },
            {
                id: 'myEvents',
                i18nKey: 'account.nav.myEvents',
                href: 'mi-cuenta/eventos',
                icon: EventIcon,
                ...PUBLISHER_ACCESS.events,
                surfaces: FULL_SURFACES,
                tourTarget: 'my-events'
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
                surfaces: CURATED_SURFACES,
                tourTarget: 'favorites'
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
                surfaces: FULL_SURFACES,
                tourTarget: 'alerts'
            },
            {
                id: 'exclusiveDeals',
                i18nKey: 'account.nav.exclusiveDeals',
                // HOS-2589 D-2: the list moved to the public promotions page.
                href: 'promociones',
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
                surfaces: FULL_SURFACES,
                tourTarget: 'reviews'
            },
            {
                id: 'inbox',
                i18nKey: 'conversations.inbox.guestInboxTitle',
                href: 'mi-cuenta/consultas',
                icon: ChatIcon,
                surfaces: FULL_SURFACES,
                tourTarget: 'inbox'
            }
        ]
    }
    // TODO(HOS-131): "Aliados"/"Partners"/"Parceiros" cajón NAV group (spec
    // §6.1) is intentionally still absent — it would gate on a partner-role
    // permission (sponsor, service provider) that does not exist yet (NG-2).
    // Add it once such a permission is introduced; the "Sumate como aliado"
    // DISCOVERY DOOR (`ACCOUNT_DISCOVERY_DOORS` in `discovery-doors.ts`,
    // HOS-134) already covers the equivalent discovery surface in the
    // meantime. Do not invent sponsor/provider PermissionEnum values ahead
    // of that decision.
];

/**
 * The provider self-service management nav entry ("Mi ficha de proveedor",
 * H-158). Deliberately kept OUTSIDE `ACCOUNT_NAV_GROUPS`: every group in that
 * catalog is gated by `requiredPermission` (evaluated by
 * `isVisibleByPermissions`), but an approved service
 * provider holds NO permission and NO role change (HOS-278 AC-7 — see
 * `src/config/discovery-doors.ts`'s `serviceProvider` option doc). There is
 * no `PermissionEnum` value this group could declare without inventing a
 * fake one, which AC-7 explicitly forbids. Ownership of the `host_trades` row
 * is the real gate.
 *
 * `AccountLayout.astro` splices this group into the sidebar only when its own
 * `GET /host-trades/mine` fetch confirms ownership — the SAME signal
 * `mi-cuenta/aliados/index.astro` already uses to force-acquire the
 * `serviceProvider` discovery-door option (`resolveDoorOptionState`'s
 * `acquiredOptionIds` override in `src/lib/nav-gating.ts`). A single-item
 * «cajón» group (`suppressHeaderWhenSingle`), the same kind of "manage what
 * you have" entry as the partner group.
 */
export const PROVIDER_NAV_GROUP: NavGroup = {
    id: 'proveedor',
    i18nKey: 'account.nav.groupProvider',
    suppressHeaderWhenSingle: true,
    items: [
        {
            id: 'provider',
            i18nKey: 'account.nav.provider',
            href: 'mi-cuenta/proveedor',
            icon: WrenchIcon,
            surfaces: FULL_SURFACES
        }
    ]
};

/**
 * A predicate that decides whether a gated node (a `NavGroup` or `NavItem`)
 * should be visible, given its `requiredPermission` declaration. Implemented
 * by `isVisibleByPermissions` in `src/lib/nav-gating.ts`.
 */
export type NavVisibilityPredicate = (node: {
    readonly requiredPermission?: PermissionEnum;
    /** Any one of these permissions makes this navigation node visible. */
    readonly requiredPermissions?: readonly PermissionEnum[];
}) => boolean;

/** Input for `getNavForSurface`. */
export interface GetNavForSurfaceParams {
    /** Which surface is rendering (filters items by `NavItem.surfaces`). */
    readonly surface: NavSurface;
    /**
     * Gating predicate — pass `isVisibleByPermissions(permissions)` on client
     * surfaces and on the server-rendered sidebar.
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

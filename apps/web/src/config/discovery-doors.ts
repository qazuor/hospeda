/**
 * @file discovery-doors.ts
 * @description Discovery doors config extracted from navigation.ts
 * (HOS-134/BETA-156) — the two `/mi-cuenta` hub CTAs.
 */

import type { IconProps } from '@repo/icons';
import {
    BuildingIcon,
    CompassIcon,
    EditIcon,
    ForkKnifeIcon,
    HomeIcon,
    MegaphoneIcon,
    StarIcon,
    UsersIcon,
    WrenchIcon
} from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import type { ComponentType } from 'react';

/**
 * A single acquirable option inside a `DiscoveryDoor` hub page (spec §6.2/§6.3).
 *
 * "Acquired" state (HOS-131 OQ-3, owner-decided): the signal is PERMISSIONS,
 * not billing entitlements — a user has "acquired" an option once they hold
 * `acquiredPermission`. Options with no `acquiredPermission` (the
 * sponsor/service-provider placeholders, NG-2) can never be acquired; they
 * render as `comingSoon` instead.
 */
export interface DiscoveryDoorOption {
    /** Stable identifier. */
    readonly id: string;
    /** i18n key for the option's title, resolved directly via `t()`. */
    readonly i18nKey: string;
    /** i18n key for the option's mini-explanation shown on the hub page. */
    readonly descriptionI18nKey: string;
    /** `@repo/icons` component reference (not a string). */
    readonly icon: ComponentType<IconProps>;
    /**
     * Path segment for the option's primary CTA: the acquire flow when
     * unacquired, or the lead-contact route when `comingSoon`. Ignored once
     * the option is acquired (the hub links `manageHref` instead).
     */
    readonly href: string;
    /** i18n key for the `href` button's label ("Publicá tu alojamiento", "Contactanos", ...). */
    readonly ctaI18nKey: string;
    /**
     * The permission that signals "already acquired" (HOS-131 OQ-3). Omitted
     * means this option can never be acquired — used only by the
     * not-yet-implemented `comingSoon` placeholders (NG-2).
     */
    readonly acquiredPermission?: PermissionEnum;
    /** Path segment for the "Gestionar" link, shown once the option is acquired. */
    readonly manageHref?: string;
    /**
     * `true` renders a "Próximamente" badge + a "Contactanos" CTA instead of
     * an acquire flow — for verticals/roles that don't exist yet (sponsor,
     * service provider). Never combined with `acquiredPermission`.
     */
    readonly comingSoon?: boolean;
    /**
     * `true` when this option's role is managed cross-app in the admin panel
     * rather than under `/mi-cuenta` (HOS-134 D-4 — e.g. the `editor` role,
     * assigned/managed by staff). When set AND the option is `acquired`, the
     * hub links the absolute admin-panel URL (`getAdminUrl()`) instead of a
     * locale-relative `manageHref`.
     */
    readonly managesInAdminPanel?: boolean;
}

/**
 * A discovery door (spec §6.2/§6.3): a CTA that leads to an internal hub page
 * listing acquirable verticals/roles ("Publicá en Hospeda" / "Sumate como
 * aliado"). Lives outside the management groups — never mixed into them.
 * Renders ONLY on the `sidebar` surface (discovery, kept out of the curated
 * avatar/mobile set — HOS-131 §6.4/§6.5).
 */
export interface DiscoveryDoor {
    /** Stable identifier. */
    readonly id: string;
    /** i18n key for the door's fixed CTA label, resolved directly via `t()`. */
    readonly i18nKey: string;
    /** i18n key for the hub page's intro subtitle, resolved directly via `t()`. */
    readonly subtitleI18nKey: string;
    /** `listing` = list-on-hospeda verticals; `partner` = B2B alliance roles. */
    readonly kind: 'listing' | 'partner';
    /** Path segment for the hub page. */
    readonly href: string;
    /** `@repo/icons` component reference (not a string). */
    readonly icon: ComponentType<IconProps>;
    /** Acquirable options shown on the hub page. */
    readonly options: readonly DiscoveryDoorOption[];
    /**
     * i18n key for the stateful "Sumá otra alianza" variant (spec §6.2),
     * shown once the user holds ≥1 partner-door option. Declared for future
     * use only — see the TODO on `ACCOUNT_DISCOVERY_DOORS` below.
     */
    readonly statefulI18nKey?: string;
}

/**
 * Discovery doors (spec §6.2/§6.3, OQ-1/OQ-3 resolved). Renders ONLY on the
 * `sidebar` surface, below `ACCOUNT_NAV_GROUPS`, gated by `isDoorVisible`
 * (`src/lib/nav-gating.ts`) — never iterate this constant directly, always
 * go through that helper so the "≥1 unacquired option" lifecycle rule
 * (spec §6.3) is applied consistently.
 */
export const ACCOUNT_DISCOVERY_DOORS: readonly DiscoveryDoor[] = [
    {
        id: 'listing',
        i18nKey: 'account.doors.publish.title',
        subtitleI18nKey: 'account.doors.publish.subtitle',
        kind: 'listing',
        href: 'mi-cuenta/publica',
        icon: BuildingIcon,
        options: [
            {
                id: 'accommodation',
                i18nKey: 'account.doors.publish.options.accommodation.title',
                descriptionI18nKey: 'account.doors.publish.options.accommodation.description',
                icon: HomeIcon,
                href: 'publicar',
                ctaI18nKey: 'account.doors.publish.options.accommodation.cta',
                acquiredPermission: PermissionEnum.ACCOMMODATION_CREATE,
                manageHref: 'mi-cuenta/host-dashboard'
            },
            {
                id: 'gastronomy',
                i18nKey: 'account.doors.publish.options.gastronomy.title',
                descriptionI18nKey: 'account.doors.publish.options.gastronomy.description',
                icon: ForkKnifeIcon,
                // Gastronomy and experience are both admin-provisioned, NOT
                // instant self-service — these are LEAD forms, not publish
                // flows (see each option's `cta` copy, which asks the user to
                // leave their info rather than implying an immediate listing).
                href: 'publicar-restaurante',
                ctaI18nKey: 'account.doors.publish.options.gastronomy.cta',
                acquiredPermission: PermissionEnum.COMMERCE_EDIT_OWN,
                manageHref: 'mi-cuenta/comercio'
            },
            {
                id: 'experience',
                i18nKey: 'account.doors.publish.options.experience.title',
                descriptionI18nKey: 'account.doors.publish.options.experience.description',
                icon: CompassIcon,
                // See the `gastronomy` option above — same lead-form nature.
                href: 'publicar-experiencia',
                ctaI18nKey: 'account.doors.publish.options.experience.cta',
                acquiredPermission: PermissionEnum.COMMERCE_EDIT_OWN,
                manageHref: 'mi-cuenta/comercio'
            }
        ]
    },
    {
        id: 'partner',
        i18nKey: 'account.doors.partner.title',
        subtitleI18nKey: 'account.doors.partner.subtitle',
        // RESOLVED (HOS-134 D-4): `editor` below is the acquired-capable
        // option that drives the stateful label — once a user holds
        // `POST_CREATE` (the editor role), `resolveDoorLabelKey`
        // (`src/lib/nav-gating.ts`) switches this door's rendered title from
        // `i18nKey` to `statefulI18nKey` ("Sumá otra alianza").
        statefulI18nKey: 'account.doors.partner.titleStateful',
        kind: 'partner',
        href: 'mi-cuenta/aliados',
        icon: UsersIcon,
        options: [
            {
                id: 'sponsor',
                i18nKey: 'account.doors.partner.options.sponsor.title',
                descriptionI18nKey: 'account.doors.partner.options.sponsor.description',
                icon: MegaphoneIcon,
                href: 'contacto',
                ctaI18nKey: 'account.doors.common.contactCta',
                // No acquiredPermission: sponsor roles don't exist yet (NG-2) —
                // this option can never resolve to 'acquired'.
                comingSoon: true
            },
            {
                id: 'partner',
                i18nKey: 'account.doors.partner.options.partner.title',
                descriptionI18nKey: 'account.doors.partner.options.partner.description',
                icon: StarIcon,
                href: 'contacto',
                ctaI18nKey: 'account.doors.common.contactCta',
                // No acquiredPermission: the home-ad partner role doesn't exist
                // yet (NG-2) — this option can never resolve to 'acquired'.
                comingSoon: true
            },
            {
                id: 'serviceProvider',
                i18nKey: 'account.doors.partner.options.serviceProvider.title',
                descriptionI18nKey: 'account.doors.partner.options.serviceProvider.description',
                icon: WrenchIcon,
                href: 'contacto',
                ctaI18nKey: 'account.doors.common.contactCta',
                // No acquiredPermission: service-provider roles don't exist yet
                // (NG-2) — this option can never resolve to 'acquired'.
                comingSoon: true
            },
            {
                id: 'editor',
                i18nKey: 'account.doors.partner.options.editor.title',
                descriptionI18nKey: 'account.doors.partner.options.editor.description',
                icon: EditIcon,
                href: 'colaborar/editores',
                ctaI18nKey: 'account.doors.partner.options.editor.cta',
                // The only aliado with a real entry form today (HOS-134 §2) —
                // an admin manually promotes the applicant to RoleEnum.EDITOR,
                // who then holds POST_CREATE and manages content in the admin
                // panel, not under /mi-cuenta (`managesInAdminPanel`).
                acquiredPermission: PermissionEnum.POST_CREATE,
                managesInAdminPanel: true
            }
        ]
    }
];

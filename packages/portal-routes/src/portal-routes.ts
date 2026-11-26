/**
 * @file portal-routes.ts
 * @description The map of the owner portal's pages shared by `apps/api` and the
 * help center (HOS-2326, spec HOS-2335 §5.1, owner decision D-1; extracted into
 * `@repo/portal-routes` by HOS-2410 PR-2).
 *
 * Every path knowledge of the portal lives in `apps/web`, which `apps/api`
 * cannot import. D-1 chose a deliberate COPY over a refactor of the web, and a
 * CI guard to keep the copy honest:
 * `scripts/check-portal-routes.ts` fails when any entry below stops resolving to
 * a page file under `apps/web/src/pages/[lang]/`. Renaming a web page therefore
 * means updating this file in the same PR.
 *
 * This module is DATA plus types, with `import type` only, on purpose: the guard
 * script loads it directly, and it must not drag the API runtime in.
 *
 * ## What it is NOT
 *
 * - Not a URL builder: `build-portal-url.ts` turns a destination into a URL.
 * - Not a source of truth for the web's routes: the web owns them. This is a
 *   copy, and the guard is the only thing keeping the two in step.
 *
 * ## Dynamic segments
 *
 * Templates use the web's own dynamic-segment names in square brackets
 * (`[id]`, `[vertical]`, `[slug]`, `[conversationId]`). `[section]` is the one
 * placeholder with no page of its own: the editor has one page file per section
 * slug, so the guard expands it over {@link EDITOR_SECTION_SLUGS}.
 */

import type { ListingSectionId, ListingVertical } from '@repo/schemas';

/** Locale the links default to: neither the user row nor the actor stores one (U-5). */
export const PORTAL_DEFAULT_LOCALE = 'es';

/** Dynamic segment of an editor template that stands for the section's URL slug. */
export const PORTAL_SECTION_PLACEHOLDER = '[section]';

/**
 * One path template per portal page the assistant links to. Paths carry no
 * locale and no slashes at the ends; the page lives under `[lang]/`.
 */
export const PORTAL_ROUTE_TEMPLATES = {
    /** Accommodation editor hub (the list of its sections). */
    accommodationEditorHub: 'mi-cuenta/propiedades/[id]/editar',
    /** One accommodation editor section. */
    accommodationEditorSection: 'mi-cuenta/propiedades/[id]/editar/[section]',
    /** Venue or experience editor hub. */
    listingEditorHub: 'mi-cuenta/comercio/[vertical]/[id]/editar',
    /** One venue or experience editor section. */
    listingEditorSection: 'mi-cuenta/comercio/[vertical]/[id]/editar/[section]',
    /** The owner's accommodations. */
    accommodationList: 'mi-cuenta/propiedades',
    /** The owner's venues and experiences (one page for both). */
    listingList: 'mi-cuenta/comercio',
    /** Publish page of accommodations. */
    createAccommodation: 'publicar',
    /** Publish page of venues. */
    createVenue: 'publicar/comer-y-salir',
    /** Publish page of experiences. */
    createExperience: 'publicar/experiencias',
    /** Plans of accommodations. */
    plansAccommodation: 'planes/anfitriones',
    /** Plans of venues. */
    plansVenue: 'planes/comer-y-salir',
    /** Plans of experiences. */
    plansExperience: 'planes/experiencias',
    /** The owner's subscription. */
    subscription: 'mi-cuenta/suscripcion',
    /** The owner's add-ons. */
    addons: 'mi-cuenta/complementos',
    /** The owner's inquiry inbox. */
    inquiryInbox: 'mi-cuenta/consultas-propietario',
    /** One inquiry thread. */
    inquiry: 'mi-cuenta/consultas-propietario/[conversationId]',
    /** Provider directory. */
    providerDirectory: 'mi-cuenta/directorio-proveedores',
    /** One provider of the directory. */
    providerDetail: 'mi-cuenta/directorio-proveedores/[slug]',
    /** Where a host declares a usage of one provider's benefit (HOS-2332). */
    providerDeclareUsage: 'mi-cuenta/directorio-proveedores/[slug]/registrar-uso',
    /** The user's benefit usages. */
    benefitUsages: 'mi-cuenta/usos-de-beneficio',
    /** The provider's own panel. */
    providerPanel: 'mi-cuenta/proveedor',
    /** Connected AI assistants. */
    aiAssistants: 'mi-cuenta/asistentes-ia',
    /** What the user's AI assistants did on their behalf (HOS-2348). */
    aiAssistantsHistory: 'mi-cuenta/asistentes-ia/historial',
    /** The public frequently-asked-questions page (HOS-2333). */
    faq: 'preguntas-frecuentes',
    /** The public contact page, where support is reached (HOS-2333). */
    contact: 'contacto',
    /** The partner's own panel (HOS-2410). */
    partnerPanel: 'mi-cuenta/partner',
    /** The help center landing (HOS-2410). The page ships in a later PR of the spec. */
    helpLanding: 'mi-cuenta/ayuda',
    /** One help article (HOS-2410). The page ships in a later PR of the spec. */
    helpArticle: 'mi-cuenta/ayuda/[id]',
    /** The account home. */
    accountHome: 'mi-cuenta',
    /** The user's public profile page. */
    accountPublicProfile: 'mi-cuenta/publica',
    /** The host dashboard. */
    hostDashboard: 'mi-cuenta/host-dashboard',
    /** The reviews received on the owner's accommodations, where the host answers them (HOS-2199). */
    receivedReviews: 'mi-cuenta/resenas-recibidas',
    /** The owner's promotions list. */
    promotions: 'mi-cuenta/promociones',
    /** The form that creates a promotion. */
    promotionNew: 'mi-cuenta/promociones/nueva',
    /** The form that edits one promotion. */
    promotionEdit: 'mi-cuenta/promociones/[id]/editar',
    /** What's new in the platform. */
    accountNews: 'mi-cuenta/novedades',
    /** Edit the user's profile. */
    accountEditProfile: 'mi-cuenta/editar',
    /** Complete the profile after sign-up. */
    accountCompleteProfile: 'mi-cuenta/completar-perfil',
    /** Change the password. */
    accountChangePassword: 'mi-cuenta/cambiar-contrasena',
    /** Add a password to an account that has none. */
    accountAddPassword: 'mi-cuenta/agregar-contrasena',
    /** Notification and account preferences. */
    accountPreferences: 'mi-cuenta/preferencias',
    /** Newsletter subscription. */
    accountNewsletter: 'mi-cuenta/newsletter',
    /** The partner's allies page. */
    accountAllies: 'mi-cuenta/aliados',
    /** Subscriber checkout. */
    checkout: 'suscriptores/checkout',
    /** Plans for subscribers. */
    subscriberPlans: 'suscriptores/planes',
    /** Landing that invites a partner to join. */
    joinPartner: 'sumate/partner',
    /** Landing that invites a provider to join. */
    joinProvider: 'sumate/proveedor',
    /** Landing that invites a sponsor to join. */
    joinSponsor: 'sumate/sponsor',
    /** Claim a partner application. */
    partnerClaim: 'partners/reclamar',
    /** Public page of one partner. */
    partnerPublicPage: 'partners/[slug]',
    /** Public page of one accommodation. */
    accommodationPublicPage: 'alojamientos/[slug]',
    /** Public page of one venue. */
    venuePublicPage: 'comer-y-salir/[slug]',
    /** Public page of one experience. */
    experiencePublicPage: 'experiencias/[slug]'
} as const;

/** Name of one entry of {@link PORTAL_ROUTE_TEMPLATES}. */
export type PortalRouteKey = keyof typeof PORTAL_ROUTE_TEMPLATES;

/**
 * Route keys whose web page has not shipped yet. `check-portal-routes` does not
 * demand a page for them. The PR that ships the page removes the key here.
 *
 * Empty since HOS-2410 PR-5 shipped the help center pages (`helpLanding`,
 * `helpArticle`). Kept as the mechanism for the next route that lands before
 * its page.
 */
export const PORTAL_UNRELEASED_ROUTE_KEYS: readonly PortalRouteKey[] = [];

/**
 * Route keys reachable through the generic `page` destination, with the Spanish
 * label each link is shown with. They are the pages the help catalog links to
 * that no dedicated destination kind covers (HOS-2410, catalog §6.3).
 */
export const PORTAL_PAGE_LABELS = {
    accountHome: 'Ir a mi cuenta',
    accountPublicProfile: 'Ver mi perfil público',
    hostDashboard: 'Abrir mi panel de anfitrión',
    receivedReviews: 'Ver las reseñas recibidas',
    promotions: 'Ver mis promociones',
    promotionNew: 'Crear una promoción',
    promotionEdit: 'Editar la promoción',
    accountNews: 'Ver las novedades',
    accountEditProfile: 'Editar mi perfil',
    accountCompleteProfile: 'Completar mi perfil',
    accountChangePassword: 'Cambiar mi contraseña',
    accountAddPassword: 'Agregar una contraseña',
    accountPreferences: 'Abrir mis preferencias',
    accountNewsletter: 'Administrar el boletín',
    accountAllies: 'Ver mis aliados',
    checkout: 'Ir al pago',
    subscriberPlans: 'Ver los planes de suscriptores',
    joinPartner: 'Sumarte como partner',
    joinProvider: 'Sumarte como proveedor',
    joinSponsor: 'Sumarte como sponsor',
    partnerClaim: 'Reclamar tu solicitud de partner',
    partnerPublicPage: 'Ver la página del partner',
    accommodationPublicPage: 'Ver la página del alojamiento',
    venuePublicPage: 'Ver la página del comercio',
    experiencePublicPage: 'Ver la página de la experiencia'
} as const satisfies Partial<Record<PortalRouteKey, string>>;

/** Name of a route reachable through the generic `page` destination. */
export type PortalPageKey = keyof typeof PORTAL_PAGE_LABELS;

/** Names of the `[dynamic]` segments of a path template, as a union. */
type TemplateParamNames<T extends string> = T extends `${string}[${infer Name}]${infer Rest}`
    ? Name | TemplateParamNames<Rest>
    : never;

/** The dynamic segments of the template a page key resolves to (`never` when it has none). */
export type PortalPageParamNames<K extends PortalPageKey> = TemplateParamNames<
    (typeof PORTAL_ROUTE_TEMPLATES)[K]
>;

/**
 * A link to one page of {@link PORTAL_PAGE_LABELS}, discriminated by `page`:
 * a page whose template has dynamic segments requires `params` with exactly
 * those names (derived from the template); any other page takes no `params`.
 */
export type PortalPageDestination = {
    readonly [K in PortalPageKey]: [PortalPageParamNames<K>] extends [never]
        ? { readonly kind: 'page'; readonly page: K; readonly params?: never }
        : {
              readonly kind: 'page';
              readonly page: K;
              readonly params: Readonly<Record<PortalPageParamNames<K>, string>>;
          };
}[PortalPageKey];

/**
 * The `[vertical]` URL segment values the venue/experience pages accept. The
 * guard checks the web still serves both (`LISTING_EDITOR_VERTICALS`).
 */
export const PORTAL_VERTICAL_SEGMENT_VALUES = ['venue', 'experience'] as const;

/** Which editor-section template each vertical's sections live under. */
export const EDITOR_SECTION_TEMPLATE_BY_VERTICAL = {
    accommodation: 'accommodationEditorSection',
    venue: 'listingEditorSection',
    experience: 'listingEditorSection'
} as const satisfies Record<ListingVertical, PortalRouteKey>;

/**
 * Catalog sections that exist in `LISTING_SECTIONS` but whose editor page has not
 * shipped, per vertical. They have no slug in {@link EDITOR_SECTION_SLUGS}: the assistant
 * must not link to a page that is a 404 (`check-portal-routes` would fail on it anyway).
 * The web flags the same sections `unreleased` in `listing-section-presentation.ts`; the
 * leaf that ships the page removes the section from BOTH lists and adds its slug.
 *
 * - No venue section remains unreleased after HOS-2271.
 */
export const UNRELEASED_EDITOR_SECTIONS = {
    accommodation: [],
    venue: [],
    experience: []
} as const satisfies { readonly [V in ListingVertical]: readonly ListingSectionId<V>[] };

/**
 * Per vertical, the editor URL slug of every catalog section
 * (`LISTING_SECTIONS` ids, `packages/schemas/src/catalog/listing-sections.ts`)
 * whose page has shipped.
 *
 * Exhaustive on purpose: a section added to the catalog stops the typecheck
 * here, the same way it stops the web's own presentation map. A section that has
 * no page yet is named in {@link UNRELEASED_EDITOR_SECTIONS} instead.
 */
export const EDITOR_SECTION_SLUGS = {
    accommodation: {
        basicInfo: 'datos',
        capacityPricing: 'capacidad-precio',
        location: 'ubicacion',
        amenities: 'servicios',
        photos: 'fotos',
        faqs: 'preguntas',
        contact: 'contacto',
        seo: 'seo',
        calendar: 'calendario',
        translations: 'traducciones',
        externalReputation: 'reputacion'
    },
    venue: {
        basicInfo: 'datos',
        location: 'ubicacion',
        openingHours: 'horarios',
        price: 'precio',
        amenities: 'servicios',
        media: 'fotos',
        contact: 'contacto',
        menu: 'carta',
        dailySpecials: 'menu-del-dia',
        venueEvents: 'eventos',
        promotions: 'promociones',
        faqs: 'preguntas',
        nightInfo: 'de-noche',
        translations: 'traducciones'
    },
    experience: {
        basicInfo: 'datos',
        meetingPoint: 'punto-de-encuentro',
        practicalInfo: 'datos-practicos',
        openingHours: 'horarios',
        price: 'precio',
        amenities: 'servicios',
        media: 'fotos',
        contact: 'contacto',
        faqs: 'preguntas',
        translations: 'traducciones'
    }
} as const satisfies {
    readonly [V in ListingVertical]: Record<
        Exclude<ListingSectionId<V>, (typeof UNRELEASED_EDITOR_SECTIONS)[V][number]>,
        string
    >;
};

/**
 * Per vertical, the editor pages that are NOT catalog sections, by the web's
 * page id, with their URL slug (HOS-2410, owner decision on PR-3 deviation 4).
 *
 * They are kept out of {@link EDITOR_SECTION_SLUGS} on purpose. That map is
 * keyed by the domain catalog (`LISTING_SECTIONS`), which describes what a
 * listing CONTAINS and drives completeness, section PATCHes and entitlement
 * gating. These pages are second editor routes the web adds at its registry:
 *
 * - `policies` (`politicas`, accommodation, HOS-2123): edits the `policies`
 *   field, which still belongs to the catalog's `amenities` section
 *   (`ACCOMMODATION_POLICIES_SECTION` in
 *   `apps/web/src/lib/editor/accommodation-editor-sections.ts`).
 * - `aiQuestions` (`preguntas-ia`, every vertical, HOS-2101): reads the chat
 *   log and edits nothing (`ACCOMMODATION_AI_QUESTIONS_SECTION` there, and
 *   `LISTING_AI_QUESTIONS_SECTION` in `listing-editor-registry.ts`).
 *
 * A `listingEditor` destination may name them as its `section`, and
 * `check-portal-routes` checks each one has its page, like the catalog sections.
 */
export const EDITOR_NON_SECTION_PAGE_SLUGS = {
    accommodation: { policies: 'politicas', aiQuestions: 'preguntas-ia' },
    venue: { aiQuestions: 'preguntas-ia' },
    experience: { aiQuestions: 'preguntas-ia' }
} as const satisfies { readonly [V in ListingVertical]: Readonly<Record<string, string>> };

/** Any editor section id, of any vertical. */
export type PortalSectionId = ListingSectionId<ListingVertical>;

/** Any editor page id that is not a catalog section, of any vertical. */
export type PortalEditorPageId = {
    [V in ListingVertical]: keyof (typeof EDITOR_NON_SECTION_PAGE_SLUGS)[V];
}[ListingVertical];

/** What a `listingEditor` destination may open: a catalog section or another editor page. */
export type PortalEditorTarget = PortalSectionId | PortalEditorPageId;

/** A vertical the owner portal manages listings for. */
export type PortalListingVertical = ListingVertical;

/**
 * Where a link points. A closed union, TypeScript only: it is never published
 * as a tool schema. The URL is built from it by `buildPortalUrl`.
 *
 * - `listingEditor`: the editor hub of a listing, or one of its pages.
 *   `section` is a catalog section id or an id of
 *   {@link EDITOR_NON_SECTION_PAGE_SLUGS}; one the vertical does not have falls
 *   back to the hub.
 * - `ownerListings`: the list of the owner's listings of a vertical.
 * - `createListing`: the publish page of a vertical.
 * - `plans`: the plans of a vertical.
 * - `inquiry`: the inquiry inbox, or one thread when `conversationId` is given.
 * - `providerDirectory`: the directory, or one provider when `slug` is given.
 * - `declareBenefitUsage`: the page where a host declares a usage of one
 *   provider's benefit. The assistant never declares (HOS-2335 NG-8); it links here.
 * - `faq` and `contact`: the public FAQ and contact pages, the fallback of the
 *   help tool (HOS-2333).
 * - `partnerPanel`: the partner's own panel.
 * - `helpLanding` and `helpArticle`: the help center and one of its articles
 *   (`id` is the article id).
 * - `page`: any page of {@link PORTAL_PAGE_LABELS}, see {@link PortalPageDestination}.
 *   `params` fills the template's dynamic segments (`id`, `slug`) and is required exactly
 *   when the page has them.
 */
export type PortalDestination =
    | {
          readonly kind: 'listingEditor';
          readonly vertical: PortalListingVertical;
          readonly id: string;
          readonly section?: PortalEditorTarget;
      }
    | { readonly kind: 'ownerListings'; readonly vertical: PortalListingVertical }
    | { readonly kind: 'createListing'; readonly vertical: PortalListingVertical }
    | { readonly kind: 'plans'; readonly vertical: PortalListingVertical }
    | { readonly kind: 'subscription' }
    | { readonly kind: 'addons' }
    | { readonly kind: 'inquiry'; readonly conversationId?: string }
    | { readonly kind: 'providerDirectory'; readonly slug?: string }
    | { readonly kind: 'declareBenefitUsage'; readonly slug: string }
    | { readonly kind: 'benefitUsages' }
    | { readonly kind: 'providerPanel' }
    | { readonly kind: 'aiAssistants' }
    | { readonly kind: 'aiAssistantsHistory' }
    | { readonly kind: 'faq' }
    | { readonly kind: 'contact' }
    | { readonly kind: 'partnerPanel' }
    | { readonly kind: 'helpLanding' }
    | { readonly kind: 'helpArticle'; readonly id: string }
    | PortalPageDestination;

/** Name of a destination kind. */
export type PortalDestinationKind = PortalDestination['kind'];

/** Per vertical, the route key of its owner listings page. */
export const OWNER_LISTINGS_ROUTE_BY_VERTICAL = {
    accommodation: 'accommodationList',
    venue: 'listingList',
    experience: 'listingList'
} as const satisfies Record<ListingVertical, PortalRouteKey>;

/** Per vertical, the route key of its publish page. */
export const CREATE_LISTING_ROUTE_BY_VERTICAL = {
    accommodation: 'createAccommodation',
    venue: 'createVenue',
    experience: 'createExperience'
} as const satisfies Record<ListingVertical, PortalRouteKey>;

/** Per vertical, the route key of its plans page. */
export const PLANS_ROUTE_BY_VERTICAL = {
    accommodation: 'plansAccommodation',
    venue: 'plansVenue',
    experience: 'plansExperience'
} as const satisfies Record<ListingVertical, PortalRouteKey>;

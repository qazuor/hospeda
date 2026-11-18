/**
 * @file portal-routes.ts
 * @description The API's own map of the owner portal's pages (HOS-2326, spec
 * HOS-2335 §5.1, owner decision D-1).
 *
 * Every path knowledge of the portal lives in `apps/web`, which `apps/api`
 * cannot import. D-1 chose a deliberate COPY in the API over a refactor of the
 * web or a shared module, and a CI guard to keep the copy honest:
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
 * - Not a source of truth for the web's routes: the web owns them. This is the
 *   API's copy, and the guard is the only thing keeping the two in step.
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
    /** The public frequently-asked-questions page (HOS-2333). */
    faq: 'preguntas-frecuentes',
    /** The public contact page, where support is reached (HOS-2333). */
    contact: 'contacto'
} as const;

/** Name of one entry of {@link PORTAL_ROUTE_TEMPLATES}. */
export type PortalRouteKey = keyof typeof PORTAL_ROUTE_TEMPLATES;

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
 * Per vertical, the editor URL slug of every catalog section
 * (`LISTING_SECTIONS` ids, `packages/schemas/src/catalog/listing-sections.ts`).
 *
 * Exhaustive on purpose: a section added to the catalog stops the typecheck
 * here, the same way it stops the web's own presentation map.
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
} as const satisfies { readonly [V in ListingVertical]: Record<ListingSectionId<V>, string> };

/** Any editor section id, of any vertical. */
export type PortalSectionId = ListingSectionId<ListingVertical>;

/** A vertical the owner portal manages listings for. */
export type PortalListingVertical = ListingVertical;

/**
 * Where a link points. A closed union, TypeScript only: it is never published
 * as a tool schema. The URL is built from it by `buildPortalUrl`.
 *
 * - `listingEditor`: the editor hub of a listing, or one of its sections.
 *   `section` is a catalog section id; one the vertical does not have falls back
 *   to the hub.
 * - `ownerListings`: the list of the owner's listings of a vertical.
 * - `createListing`: the publish page of a vertical.
 * - `plans`: the plans of a vertical.
 * - `inquiry`: the inquiry inbox, or one thread when `conversationId` is given.
 * - `providerDirectory`: the directory, or one provider when `slug` is given.
 * - `declareBenefitUsage`: the page where a host declares a usage of one
 *   provider's benefit. The assistant never declares (HOS-2335 NG-8); it links here.
 * - `faq` and `contact`: the public FAQ and contact pages, the fallback of the
 *   help tool (HOS-2333).
 */
export type PortalDestination =
    | {
          readonly kind: 'listingEditor';
          readonly vertical: PortalListingVertical;
          readonly id: string;
          readonly section?: PortalSectionId;
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
    | { readonly kind: 'faq' }
    | { readonly kind: 'contact' };

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

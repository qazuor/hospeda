/**
 * @file listing-section-presentation.ts
 * @description The web-side presentation of every catalog section for the
 * venue, experience and accommodation editors (HOS-1787 leaf 5.1, F-V1-048; HOS-1809).
 *
 * The DOMAIN of a section (id, fields, traits, order, group, entitlement) lives
 * in `@repo/schemas`. What only the web knows — the URL slug below `…/editar/`
 * and the i18n key of the nav label — lives here.
 *
 * Both records are `satisfies Record<ListingSectionId<V>, …>` rather than
 * partial maps: a section added to the catalog without its slug and label stops
 * the build immediately. Before this file existed the section list was written
 * by hand in three places, so the catalog could grow while the editor silently
 * kept offering the old set.
 */

import type { ListingSectionId, ListingVertical } from '@repo/schemas';

/** What the web adds to one catalog section. */
export interface ListingSectionPresentation {
    /** URL segment below `…/editar/`. Spanish, matching the rest of the web app. */
    readonly slug: string;
    /** i18n key of the visible nav / hub / breadcrumb label. */
    readonly labelKey: string;
    /**
     * Key of a runtime visibility answer (see `EditorSection.visibilityKey`).
     * Only a section that is shown conditionally declares one.
     */
    readonly visibilityKey?: string;
}

/**
 * The visibility key of the one conditional accommodation section (its
 * translations page, shown only when translation data exists).
 */
export const ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY = 'translations';

/** Venue section presentation — one entry for every venue catalog section. */
const VENUE_SECTION_PRESENTATION = {
    basicInfo: {
        slug: 'datos',
        labelKey: 'listing.owner.editor.sectionNav.basicInfo'
    },
    location: {
        slug: 'ubicacion',
        labelKey: 'listing.owner.editor.sectionNav.location'
    },
    openingHours: {
        slug: 'horarios',
        labelKey: 'listing.owner.editor.sectionNav.openingHours'
    },
    price: {
        slug: 'precio',
        labelKey: 'listing.owner.editor.sectionNav.price'
    },
    amenities: {
        slug: 'servicios',
        labelKey: 'listing.owner.editor.sectionNav.amenities'
    },
    media: {
        slug: 'fotos',
        labelKey: 'listing.owner.editor.sectionNav.media'
    },
    contact: {
        slug: 'contacto',
        // Not `sectionNav.contactInfo` — this page absorbs the former standalone
        // "Redes sociales" section too, so the label has to cover both.
        labelKey: 'listing.owner.editor.sectionNav.contactSocial'
    },
    menu: {
        slug: 'carta',
        labelKey: 'listing.owner.editor.sectionNav.menu'
    },
    dailySpecials: {
        slug: 'menu-del-dia',
        labelKey: 'listing.owner.editor.sectionNav.dailySpecials'
    },
    venueEvents: {
        slug: 'eventos',
        labelKey: 'listing.owner.editor.sectionNav.venueEvents'
    },
    faqs: {
        slug: 'preguntas',
        labelKey: 'listing.owner.editor.sectionNav.faqs'
    },
    nightInfo: {
        slug: 'de-noche',
        labelKey: 'listing.owner.editor.sectionNav.nightInfo'
    },
    translations: {
        slug: 'traducciones',
        labelKey: 'listing.owner.editor.sectionNav.translations'
    }
} satisfies Record<ListingSectionId<'venue'>, ListingSectionPresentation>;

/** Experience section presentation — one entry for every experience catalog section. */
const EXPERIENCE_SECTION_PRESENTATION = {
    basicInfo: {
        slug: 'datos',
        labelKey: 'listing.owner.editor.sectionNav.basicInfo'
    },
    meetingPoint: {
        slug: 'punto-de-encuentro',
        labelKey: 'listing.owner.editor.sectionNav.meetingPoint'
    },
    practicalInfo: {
        slug: 'datos-practicos',
        labelKey: 'listing.owner.editor.sectionNav.practicalInfo'
    },
    openingHours: {
        slug: 'horarios',
        labelKey: 'listing.owner.editor.sectionNav.openingHours'
    },
    price: {
        slug: 'precio',
        labelKey: 'listing.owner.editor.sectionNav.price'
    },
    amenities: {
        slug: 'servicios',
        labelKey: 'listing.owner.editor.sectionNav.amenities'
    },
    media: {
        slug: 'fotos',
        labelKey: 'listing.owner.editor.sectionNav.media'
    },
    contact: {
        slug: 'contacto',
        labelKey: 'listing.owner.editor.sectionNav.contactSocial'
    },
    faqs: {
        slug: 'preguntas',
        labelKey: 'listing.owner.editor.sectionNav.faqs'
    },
    translations: {
        slug: 'traducciones',
        labelKey: 'listing.owner.editor.sectionNav.translations'
    }
} satisfies Record<ListingSectionId<'experience'>, ListingSectionPresentation>;

/** Accommodation section presentation — one entry for every accommodation catalog section. */
const ACCOMMODATION_SECTION_PRESENTATION = {
    basicInfo: {
        slug: 'datos',
        labelKey: 'host.properties.editor.section.basicInfo'
    },
    capacityPricing: {
        slug: 'capacidad-precio',
        // Not `section.capacity` — that key reads just "Capacidad", while this
        // page also owns the price fields.
        labelKey: 'host.properties.editor.section.capacityPricing'
    },
    location: {
        slug: 'ubicacion',
        labelKey: 'host.properties.editor.section.location'
    },
    amenities: {
        slug: 'servicios',
        labelKey: 'host.properties.editor.section.amenities'
    },
    photos: {
        slug: 'fotos',
        labelKey: 'host.properties.editor.section.photos'
    },
    faqs: {
        slug: 'preguntas',
        labelKey: 'host.properties.editor.section.faqs'
    },
    contact: {
        slug: 'contacto',
        // Not `section.contact` — this page absorbs the former standalone
        // "Redes sociales" section too, so the label has to cover both.
        labelKey: 'host.properties.editor.section.contactSocial'
    },
    seo: {
        slug: 'seo',
        // G7 smoke (H-121): SEO is a distinct concern from the listing's own
        // content and from reaching the host, so it has its own page.
        labelKey: 'host.properties.editor.section.seo'
    },
    calendar: {
        slug: 'calendario',
        labelKey: 'host.properties.editor.section.calendar'
    },
    translations: {
        slug: 'traducciones',
        labelKey: 'host.properties.editor.translation.sectionTitle',
        visibilityKey: ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY
    },
    externalReputation: {
        slug: 'reputacion',
        labelKey: 'host.properties.editor.section.externalReputation'
    }
} satisfies Record<ListingSectionId<'accommodation'>, ListingSectionPresentation>;

/**
 * Every section's web presentation, per vertical.
 *
 * The inner maps keep their exhaustive `satisfies` above; indexing through the
 * outer `Record<string, …>` keeps the registry free of per-vertical branching
 * (G-FAC-05 arrives over these files in leaf 5.8).
 */
export const LISTING_SECTION_PRESENTATION: Readonly<
    Record<ListingVertical, Readonly<Record<string, ListingSectionPresentation>>>
> = {
    venue: VENUE_SECTION_PRESENTATION,
    experience: EXPERIENCE_SECTION_PRESENTATION,
    accommodation: ACCOMMODATION_SECTION_PRESENTATION
};

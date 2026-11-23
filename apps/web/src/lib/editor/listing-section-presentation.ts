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
import type { EditorSaveModel } from '@/lib/editor/editor-registry';

/** What the web adds to one catalog section. */
export interface ListingSectionPresentation {
    /** URL segment below `…/editar/`. Spanish, matching the rest of the web app. */
    readonly slug: string;
    /** i18n key of the visible nav / hub / breadcrumb label. */
    readonly labelKey: string;
    /**
     * How the section's page saves (HOS-2487, spec HOS-2415 §6.2). Data, not
     * dispatch by section id (G-FAC-05): the shell reads it to pick the save
     * signal.
     */
    readonly saveModel: EditorSaveModel;
    /**
     * Key of a runtime visibility answer (see `EditorSection.visibilityKey`).
     * Only a section that is shown conditionally declares one.
     */
    readonly visibilityKey?: string;
    /**
     * The section exists in the catalog but its editor page does not ship yet, so the
     * nav, the hub and the registry must not offer it (a link would 404). Removed by
     * the leaf that adds the page. Data, not dispatch by section id (G-FAC-05).
     */
    readonly unreleased?: boolean;
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
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.basicInfo'
    },
    location: {
        slug: 'ubicacion',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.location'
    },
    openingHours: {
        slug: 'horarios',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.openingHours'
    },
    price: {
        slug: 'precio',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.price'
    },
    amenities: {
        slug: 'servicios',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.amenities'
    },
    media: {
        slug: 'fotos',
        saveModel: 'auto',
        labelKey: 'listing.owner.editor.sectionNav.media'
    },
    contact: {
        slug: 'contacto',
        saveModel: 'bar',
        // Not `sectionNav.contactInfo` — this page absorbs the former standalone
        // "Redes sociales" section too, so the label has to cover both.
        labelKey: 'listing.owner.editor.sectionNav.contactSocial'
    },
    menu: {
        slug: 'carta',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.menu'
    },
    dailySpecials: {
        slug: 'menu-del-dia',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.dailySpecials'
    },
    venueEvents: {
        slug: 'eventos',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.venueEvents'
    },
    promotions: {
        slug: 'promociones',
        saveModel: 'auto',
        labelKey: 'listing.owner.editor.sectionNav.venuePromotions'
    },
    faqs: {
        slug: 'preguntas',
        saveModel: 'auto',
        labelKey: 'listing.owner.editor.sectionNav.faqs'
    },
    nightInfo: {
        slug: 'de-noche',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.nightInfo'
    },
    translations: {
        slug: 'traducciones',
        // `bar`, not the spec's `auto`: this page is a field of the
        // ListingEditor form and saves with it. Moving it to per-row saves is a
        // model change HOS-2415 NG-3 keeps out of this epic.
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.translations'
    }
} satisfies Record<ListingSectionId<'venue'>, ListingSectionPresentation>;

/** Experience section presentation — one entry for every experience catalog section. */
const EXPERIENCE_SECTION_PRESENTATION = {
    basicInfo: {
        slug: 'datos',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.basicInfo'
    },
    meetingPoint: {
        slug: 'punto-de-encuentro',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.meetingPoint'
    },
    practicalInfo: {
        slug: 'datos-practicos',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.practicalInfo'
    },
    openingHours: {
        slug: 'horarios',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.openingHours'
    },
    price: {
        slug: 'precio',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.price'
    },
    amenities: {
        slug: 'servicios',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.amenities'
    },
    media: {
        slug: 'fotos',
        saveModel: 'auto',
        labelKey: 'listing.owner.editor.sectionNav.media'
    },
    contact: {
        slug: 'contacto',
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.contactSocial'
    },
    faqs: {
        slug: 'preguntas',
        saveModel: 'auto',
        labelKey: 'listing.owner.editor.sectionNav.faqs'
    },
    translations: {
        slug: 'traducciones',
        // `bar`, not the spec's `auto`: this page is a field of the
        // ListingEditor form and saves with it. Moving it to per-row saves is a
        // model change HOS-2415 NG-3 keeps out of this epic.
        saveModel: 'bar',
        labelKey: 'listing.owner.editor.sectionNav.translations'
    }
} satisfies Record<ListingSectionId<'experience'>, ListingSectionPresentation>;

/** Accommodation section presentation — one entry for every accommodation catalog section. */
const ACCOMMODATION_SECTION_PRESENTATION = {
    basicInfo: {
        slug: 'datos',
        saveModel: 'bar',
        labelKey: 'host.properties.editor.section.basicInfo'
    },
    capacityPricing: {
        slug: 'capacidad-precio',
        saveModel: 'bar',
        // Not `section.capacity` — that key reads just "Capacidad", while this
        // page also owns the price fields.
        labelKey: 'host.properties.editor.section.capacityPricing'
    },
    location: {
        slug: 'ubicacion',
        saveModel: 'bar',
        labelKey: 'host.properties.editor.section.location'
    },
    amenities: {
        slug: 'servicios',
        saveModel: 'bar',
        labelKey: 'host.properties.editor.section.amenities'
    },
    photos: {
        slug: 'fotos',
        saveModel: 'auto',
        labelKey: 'host.properties.editor.section.photos'
    },
    faqs: {
        slug: 'preguntas',
        saveModel: 'auto',
        labelKey: 'host.properties.editor.section.faqs'
    },
    contact: {
        slug: 'contacto',
        saveModel: 'bar',
        // Not `section.contact` — this page absorbs the former standalone
        // "Redes sociales" section too, so the label has to cover both.
        labelKey: 'host.properties.editor.section.contactSocial'
    },
    seo: {
        slug: 'seo',
        saveModel: 'bar',
        // G7 smoke (H-121): SEO is a distinct concern from the listing's own
        // content and from reaching the host, so it has its own page.
        labelKey: 'host.properties.editor.section.seo'
    },
    calendar: {
        slug: 'calendario',
        saveModel: 'auto',
        labelKey: 'host.properties.editor.section.calendar'
    },
    translations: {
        slug: 'traducciones',
        // Per action (the generate button), like the spec's «per row».
        saveModel: 'auto',
        labelKey: 'host.properties.editor.translation.sectionTitle',
        visibilityKey: ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY
    },
    externalReputation: {
        slug: 'reputacion',
        saveModel: 'auto',
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

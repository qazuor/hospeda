/**
 * @file listing-section-presentation.ts
 * @description The web-side presentation of every catalog section for the
 * venue and experience editors (HOS-1787 leaf 5.1, F-V1-048).
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

import type { ListingSectionId } from '@repo/schemas';

/** What the web adds to one catalog section. */
export interface ListingSectionPresentation {
    /** URL segment below `…/editar/`. Spanish, matching the rest of the web app. */
    readonly slug: string;
    /** i18n key of the visible nav / hub / breadcrumb label. */
    readonly labelKey: string;
}

/** Venue section presentation — one entry for every venue catalog section. */
const VENUE_SECTION_PRESENTATION = {
    basicInfo: {
        slug: 'datos',
        labelKey: 'listing.owner.editor.sectionNav.basicInfo'
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

/**
 * Every section's web presentation, per vertical.
 *
 * The inner maps keep their exhaustive `satisfies` above; indexing through the
 * outer `Record<string, …>` keeps the registry free of per-vertical branching
 * (G-FAC-05 arrives over these files in leaf 5.8).
 */
export const LISTING_SECTION_PRESENTATION: Readonly<
    Record<'venue' | 'experience', Readonly<Record<string, ListingSectionPresentation>>>
> = {
    venue: VENUE_SECTION_PRESENTATION,
    experience: EXPERIENCE_SECTION_PRESENTATION
};

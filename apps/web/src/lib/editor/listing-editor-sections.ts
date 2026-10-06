/**
 * @file listing-editor-sections.ts
 * @description Shared section registry pieces for the gastronomy and experience
 * editors (HOS-1080, closing HOS-892).
 *
 * The owner editor used to be ONE route rendering every field group as an
 * anchor on a single page, while the accommodation editor had thirteen routes.
 * HOS-892 reported the symptom of that ("un formulario larguísimo sin
 * encabezados"); the owner's decision was to level up rather than down, so the
 * gastronomy and experience editors now mirror `accommodation-editor-sections.ts`
 * and the nav, the hub and the breadcrumbs all derive from the registries.
 *
 * This file holds what the two verticals have IN COMMON: the sections both have,
 * the group order and the group headings, and the registry factory. The sections
 * only one vertical has live in `gastronomy-editor-sections.ts` and
 * `experience-editor-sections.ts`; `listing-editor-registry.ts` picks between
 * them by vertical.
 *
 * No section uses a runtime `visibilityKey`. The amenities page was the
 * candidate — `AmenitiesSection` renders nothing when both catalogs come back
 * empty — but answering that on the nav would mean fetching both catalogs on
 * ALL eleven pages to decide whether to draw one link. The accommodation editor
 * makes the same trade (its `servicios` entry is unconditional and only its own
 * route fetches the catalog); the `servicios` route carries the empty-catalog
 * case as a visible notice instead, which is a better answer than a silently
 * missing nav item anyway.
 */

import type { EditorRegistry, EditorSection } from '@/lib/editor/editor-registry';
import type { GastronomyOrExperience } from '@/lib/listing/owner-listings';

/** Sections every gastronomy and experience listing has, in nav order. */
export const LISTING_SHARED_EDITOR_SECTIONS: readonly EditorSection[] = [
    {
        id: 'basicInfo',
        slug: 'datos',
        group: 'property',
        labelKey: 'listing.owner.editor.sectionNav.basicInfo'
    },
    {
        id: 'openingHours',
        slug: 'horarios',
        group: 'property',
        labelKey: 'listing.owner.editor.sectionNav.openingHours'
    },
    {
        id: 'price',
        slug: 'precio',
        group: 'property',
        labelKey: 'listing.owner.editor.sectionNav.price'
    },
    {
        id: 'amenities',
        slug: 'servicios',
        group: 'property',
        labelKey: 'listing.owner.editor.sectionNav.amenities'
    },
    {
        id: 'media',
        slug: 'fotos',
        group: 'content',
        labelKey: 'listing.owner.editor.sectionNav.media'
    },
    {
        id: 'contact',
        slug: 'contacto',
        group: 'content',
        // Not `sectionNav.contactInfo` — this page absorbs the former standalone
        // "Redes sociales" section too, exactly as the accommodation editor's
        // `contacto` page does, so the label has to cover both.
        labelKey: 'listing.owner.editor.sectionNav.contactSocial'
    },
    {
        id: 'faqs',
        slug: 'preguntas',
        group: 'content',
        labelKey: 'listing.owner.editor.sectionNav.faqs'
    },
    {
        id: 'translations',
        slug: 'traducciones',
        group: 'management',
        labelKey: 'listing.owner.editor.sectionNav.translations'
    }
];

/** Group order for rendering. */
export const LISTING_EDITOR_SECTION_GROUPS = ['property', 'content', 'management'] as const;

/**
 * i18n key for each group heading.
 *
 * The bucket ids are shared with the accommodation editor (see
 * `EditorSectionGroup`); only the visible headings differ, which is the whole
 * reason the labels live on the registry rather than on the type.
 */
export const LISTING_EDITOR_GROUP_LABEL_KEYS = {
    property: 'listing.owner.editor.group.listing',
    content: 'listing.owner.editor.group.content',
    management: 'listing.owner.editor.group.management'
} as const;

/**
 * Assembles the registry for one vertical from its own section list.
 *
 * **The hub path carries the vertical** (`mi-cuenta/comercio/<vertical>/…`), so a
 * registry that did not know it could not build a single URL.
 *
 * @param params - The vertical being edited and its ordered sections.
 * @returns The registry the shared nav / hub / breadcrumb machinery reads.
 */
export function createListingEditorRegistry({
    vertical,
    sections
}: {
    readonly vertical: GastronomyOrExperience;
    readonly sections: readonly EditorSection[];
}): EditorRegistry {
    return {
        id: vertical,
        sections,
        groups: LISTING_EDITOR_SECTION_GROUPS,
        groupLabelKeys: LISTING_EDITOR_GROUP_LABEL_KEYS,
        indexPath: 'mi-cuenta/comercio',
        indexLabelKey: 'listing.owner.editor.breadcrumb.listings',
        buildHubPath: ({ entityId }) => `mi-cuenta/comercio/${vertical}/${entityId}/editar`
    };
}

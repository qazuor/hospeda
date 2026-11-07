/**
 * @file listing-editor-sections.ts
 * @description Shared section registry pieces for the venue and experience
 * editors (HOS-1080, closing HOS-892).
 *
 * The owner editor used to be ONE route rendering every field group as an
 * anchor on a single page, while the accommodation editor had thirteen routes.
 * HOS-892 reported the symptom of that ("un formulario larguísimo sin
 * encabezados"); the owner's decision was to level up rather than down, so the
 * venue and experience editors now mirror `accommodation-editor-sections.ts`
 * and the nav, the hub and the breadcrumbs all derive from the registries.
 *
 * This file holds what the two verticals have IN COMMON: the group order, the
 * group headings, and the registry factory. The sections themselves are derived
 * from the catalog in `listing-editor-registry.ts` since HOS-1787 leaf 5.1.
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
import type { VenueOrExperience } from '@/lib/listing/owner-listings';

/** Group order for rendering. */
export const LISTING_EDITOR_SECTION_GROUPS = ['property', 'content', 'management'] as const;

/**
 * The two verticals the shared listing editor serves, as a lookup.
 *
 * Accommodation keeps its own editor (`resolve-editor-page.ts`) until child 8.
 * A record rather than `vertical === 'venue' || vertical === 'experience'`:
 * G-FAC-05 (leaf 5.8) forbids the editor from deciding by a vertical literal.
 */
export const LISTING_EDITOR_VERTICALS: Readonly<Record<VenueOrExperience, true>> = {
    venue: true,
    experience: true
};

/**
 * Whether a route's `vertical` segment is one the shared listing editor knows.
 *
 * The route param arrives as a plain string, so this is also the type guard that
 * narrows it to `VenueOrExperience` without comparing against a literal.
 *
 * @param value - The raw `[vertical]` route segment, possibly absent.
 * @returns `true` when the editor serves that vertical.
 */
export function isListingEditorVertical(value: string | undefined): value is VenueOrExperience {
    return value !== undefined && Object.hasOwn(LISTING_EDITOR_VERTICALS, value);
}

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
    readonly vertical: VenueOrExperience;
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

/**
 * @file experience-editor-sections.ts
 * @description Section registry for the experience editor, the counterpart of
 * `accommodation-editor-sections.ts` (HOS-1080).
 *
 * `meetingPoint` and `practicalInfo` are gated by the SHAPE of the schema: their
 * keys live on `ExperienceOwnerUpdateInputSchema` and not on the gastronomy one,
 * so for a restaurant they are not "hidden", they do not exist. Shared pieces
 * live in `listing-editor-sections.ts`.
 */

import type { EditorRegistry, EditorSection } from '@/lib/editor/editor-registry';
import {
    createListingEditorRegistry,
    LISTING_SHARED_EDITOR_SECTIONS
} from '@/lib/editor/listing-editor-sections';

/**
 * Sections that exist only on the experience vertical.
 *
 * Inserted directly after `basicInfo`, which is where they render in the
 * pre-split editor and therefore where an owner already expects them.
 */
const EXPERIENCE_ONLY_SECTIONS: readonly EditorSection[] = [
    {
        id: 'meetingPoint',
        slug: 'punto-de-encuentro',
        group: 'property',
        labelKey: 'listing.owner.editor.sectionNav.meetingPoint'
    },
    {
        id: 'practicalInfo',
        slug: 'datos-practicos',
        group: 'property',
        labelKey: 'listing.owner.editor.sectionNav.practicalInfo'
    }
];

/**
 * Builds the experience section list, in nav order.
 *
 * @returns The experience sections, with the experience-only pair right after
 * basic info.
 */
export function buildExperienceEditorSections(): readonly EditorSection[] {
    const [basicInfo, ...rest] = LISTING_SHARED_EDITOR_SECTIONS;
    // The shared list is a non-empty literal, so `basicInfo` is always defined;
    // the guard exists because TypeScript cannot see that through `readonly[]`.
    return basicInfo
        ? [basicInfo, ...EXPERIENCE_ONLY_SECTIONS, ...rest]
        : LISTING_SHARED_EDITOR_SECTIONS;
}

/**
 * Builds the editor registry for an experience listing.
 *
 * @returns The registry the shared nav / hub / breadcrumb machinery reads.
 */
export function buildExperienceEditorRegistry(): EditorRegistry {
    return createListingEditorRegistry({
        vertical: 'experience',
        sections: buildExperienceEditorSections()
    });
}

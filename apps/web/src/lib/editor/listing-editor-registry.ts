/**
 * @file listing-editor-registry.ts
 * @description Picks the editor registry for a gastronomy or experience listing
 * by its vertical (HOS-1080).
 *
 * The per-vertical registries live in `gastronomy-editor-sections.ts` and
 * `experience-editor-sections.ts`; callers that already hold the vertical as a
 * route param (`'gastronomy' | 'experience'`) use these two functions instead
 * of branching themselves.
 */

import type { EditorRegistry, EditorSection } from '@/lib/editor/editor-registry';
import {
    buildExperienceEditorRegistry,
    buildExperienceEditorSections
} from '@/lib/editor/experience-editor-sections';
import {
    buildGastronomyEditorRegistry,
    buildGastronomyEditorSections
} from '@/lib/editor/gastronomy-editor-sections';
import type { GastronomyOrExperience } from '@/lib/listing/owner-listings';

/**
 * Builds the section list for one vertical, in nav order.
 *
 * @param params - The vertical whose editor is being rendered.
 * @returns The sections, experience-only entries included only for experiences.
 */
export function buildListingEditorSections({
    vertical
}: {
    readonly vertical: GastronomyOrExperience;
}): readonly EditorSection[] {
    return vertical === 'experience'
        ? buildExperienceEditorSections()
        : buildGastronomyEditorSections();
}

/**
 * Builds the editor registry for one listing's vertical.
 *
 * @param params - The vertical whose editor is being rendered.
 * @returns The registry the shared nav / hub / breadcrumb machinery reads.
 */
export function buildListingEditorRegistry({
    vertical
}: {
    readonly vertical: GastronomyOrExperience;
}): EditorRegistry {
    return vertical === 'experience'
        ? buildExperienceEditorRegistry()
        : buildGastronomyEditorRegistry();
}

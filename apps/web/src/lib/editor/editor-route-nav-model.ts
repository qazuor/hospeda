/**
 * @file editor-route-nav-model.ts
 * @description Pure view model for the editor's route navigation (HOS-318 T-005).
 *
 * Follows the `waveHeaderState.ts` pattern: the decisions live in a pure,
 * unit-tested function and the `.astro` component only renders the result.
 * `.astro` files cannot be rendered in Vitest, so logic kept inside one can only
 * be asserted by reading its source — which cannot tell a declared behaviour
 * from a rendered one.
 *
 * ## Why there is no scrollspy here
 *
 * The pre-split nav tracked the active section with an `IntersectionObserver`
 * and a hand-tuned `rootMargin`, because every section shared one page. Now each
 * section IS a page, so the active item is simply the current route — exact
 * instead of approximate, and with no JS at all (HOS-318 D-9).
 */

import {
    ACCOMMODATION_EDITOR_SECTIONS,
    buildEditorSectionUrl,
    EDITOR_SECTION_GROUP_LABEL_KEYS,
    EDITOR_SECTION_GROUPS,
    type EditorSection,
    type EditorSectionGroup
} from '@/lib/editor/accommodation-editor-sections';
import type { SupportedLocale } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One rendered nav link. */
export interface EditorNavLink {
    readonly sectionId: string;
    readonly href: string;
    /** i18n key — resolved by the renderer, which owns the `t` function. */
    readonly labelKey: string;
    /** True for the section currently being edited. At most one link is active. */
    readonly isActive: boolean;
}

/** One rendered nav group: a heading plus its links. */
export interface EditorNavGroup {
    readonly group: EditorSectionGroup;
    readonly headingKey: string;
    readonly links: readonly EditorNavLink[];
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * Builds the grouped nav model for one editor page.
 *
 * @param params - Locale, accommodation id, the active section, and whether the
 * conditional translations section should appear.
 * @returns The groups to render, in declared order, each with its links. Groups
 * that end up with no links are omitted entirely — an empty heading is noise.
 */
export function buildEditorNavModel({
    locale,
    accommodationId,
    currentSectionId,
    hasTranslations
}: {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    /** `null` on the hub, where no section is active. */
    readonly currentSectionId: string | null;
    readonly hasTranslations: boolean;
}): readonly EditorNavGroup[] {
    const visible = ACCOMMODATION_EDITOR_SECTIONS.filter((section) =>
        isSectionVisible({ section, hasTranslations })
    );

    return EDITOR_SECTION_GROUPS.map((group) => ({
        group,
        headingKey: EDITOR_SECTION_GROUP_LABEL_KEYS[group],
        links: visible
            .filter((section) => section.group === group)
            .map((section) => ({
                sectionId: section.id,
                href: buildEditorSectionUrl({ locale, accommodationId, section }),
                labelKey: section.labelKey,
                isActive: section.id === currentSectionId
            }))
    })).filter((navGroup) => navGroup.links.length > 0);
}

/**
 * Decides whether a section appears at all.
 *
 * @param params - The section and the availability of conditional data.
 * @returns True when the section should be listed.
 */
function isSectionVisible({
    section,
    hasTranslations
}: {
    readonly section: EditorSection;
    readonly hasTranslations: boolean;
}): boolean {
    if (section.id === 'translations') return hasTranslations;
    return true;
}

/**
 * Counts the active links across the whole model.
 *
 * Exposed so a test can assert the "at most one active" invariant directly
 * rather than re-deriving it, and so a caller can detect an unknown
 * `currentSectionId` (which yields zero).
 *
 * @param params - The built nav model.
 * @returns How many links are marked active.
 */
export function countActiveLinks({
    groups
}: {
    readonly groups: readonly EditorNavGroup[];
}): number {
    return groups.reduce(
        (total, group) => total + group.links.filter((link) => link.isActive).length,
        0
    );
}

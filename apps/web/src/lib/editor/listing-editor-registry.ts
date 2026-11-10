/**
 * @file listing-editor-registry.ts
 * @description Builds the venue/experience editor registry from the listing
 * catalog and the section-state map the resolver read from the API (HOS-1787
 * leaf 5.1, DEC-FAC-033).
 *
 * Until this leaf each vertical had its own hand-written section list and the
 * two lists disagreed with the catalog by construction. The catalog (order and
 * group) is now the only source: the sections this editor offers are the
 * catalog's sections for the vertical, minus the ones the resolver marked
 * `absent`. `locked` stays in — its UI treatment belongs to leaf 5.2.
 *
 * Slug and label are web-only concerns and live in
 * `listing-section-presentation.ts`, which is exhaustive per vertical.
 */

import { LISTING_SECTIONS, type ListingSectionState } from '@repo/schemas';
import type { EditorRegistry, EditorSection } from '@/lib/editor/editor-registry';
import { createListingEditorRegistry } from '@/lib/editor/listing-editor-sections';
import { LISTING_SECTION_PRESENTATION } from '@/lib/editor/listing-section-presentation';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';

/**
 * One section's entry in the state map returned by
 * `GET /api/v1/protected/{venues,experiences}/:id/sections`.
 */
export interface ListingSectionStateEntry {
    readonly state: ListingSectionState;
    readonly traits?: Readonly<Record<string, ListingSectionState>>;
}

/**
 * The `sections` object the API answers with, keyed by section id.
 *
 * Structural rather than tied to one vertical's inferred type: the resolver
 * handles both, and a missing key reads as "not absent" (the API always sends
 * the complete map).
 */
export type ListingSectionStates = Readonly<Record<string, ListingSectionStateEntry>>;

/**
 * Builds the section list for one vertical, in catalog order.
 *
 * @param params - The vertical and the resolved state map.
 * @returns The non-absent catalog sections, in the order and group the
 * catalog declares.
 */
export function buildListingEditorSections({
    vertical,
    sectionStates
}: {
    readonly vertical: VenueOrExperience;
    readonly sectionStates: ListingSectionStates;
}): readonly EditorSection[] {
    const sections = LISTING_SECTIONS[vertical]
        .filter((definition) => sectionStates[definition.id]?.state !== 'absent')
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((definition): EditorSection => {
            const presentation = LISTING_SECTION_PRESENTATION[vertical][definition.id];

            return {
                id: definition.id,
                slug: presentation.slug,
                group: definition.group,
                labelKey: presentation.labelKey
            };
        });
    return insertAiQuestionsSection({ sections });
}

/**
 * The «Preguntas a la IA» page (HOS-2101). Web-only: it edits nothing, so it is
 * not a section of the domain catalog (`@repo/schemas` `LISTING_SECTIONS`),
 * which describes what a listing CONTAINS and drives completeness and the
 * section PATCH. Every vertical with a chat gets it, whatever its plan.
 */
export const LISTING_AI_QUESTIONS_SECTION: EditorSection = {
    id: 'aiQuestions',
    slug: 'preguntas-ia',
    group: 'content',
    labelKey: 'listing.owner.editor.sectionNav.aiQuestions'
};

/**
 * Places {@link LISTING_AI_QUESTIONS_SECTION} right after the FAQs (its main
 * action creates one), or last when the vertical has no FAQ section.
 *
 * @param params - The catalog-derived sections.
 * @returns The sections with the AI questions page inserted.
 */
function insertAiQuestionsSection({
    sections
}: {
    readonly sections: readonly EditorSection[];
}): readonly EditorSection[] {
    const faqIndex = sections.findIndex((section) => section.id === 'faqs');
    if (faqIndex === -1) {
        return [...sections, LISTING_AI_QUESTIONS_SECTION];
    }
    return [
        ...sections.slice(0, faqIndex + 1),
        LISTING_AI_QUESTIONS_SECTION,
        ...sections.slice(faqIndex + 1)
    ];
}

/**
 * Builds the editor registry for one listing's vertical.
 *
 * @param params - The vertical and the resolved state map.
 * @returns The registry the shared nav / hub / breadcrumb machinery reads.
 */
export function buildListingEditorRegistry({
    vertical,
    sectionStates
}: {
    readonly vertical: VenueOrExperience;
    readonly sectionStates: ListingSectionStates;
}): EditorRegistry {
    return createListingEditorRegistry({
        vertical,
        sections: buildListingEditorSections({ vertical, sectionStates })
    });
}

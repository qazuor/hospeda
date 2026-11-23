/**
 * @file accommodation-editor-sections.ts
 * @description Single source of truth for the accommodation editor's sections
 * (HOS-318).
 *
 * The editor is one page per section. The route nav, the hub list and the
 * breadcrumbs ALL derive from this registry — a section must never be spelled
 * out twice, or the three surfaces drift and a route ends up reachable from one
 * of them but not the others.
 *
 * Since HOS-1809 the sections are DERIVED from the domain catalog
 * (`LISTING_SECTIONS.accommodation`) and the web presentation
 * (`listing-section-presentation.ts`), the same way venue and experience do. The
 * hand-written list and its freezing guard (G-FAC-08) are gone.
 *
 * Ordering is the catalog's: the nav renders sections grouped by `group` in the
 * order the groups first appear.
 */

import {
    buildEditorHubUrl as buildRegistryHubUrl,
    buildEditorSectionUrl as buildRegistrySectionUrl,
    type EditorRegistry,
    type EditorSection,
    type EditorSectionGroup,
    findEditorSectionBySlug as findRegistrySectionBySlug,
    getVisibleEditorSections as getVisibleRegistrySections
} from '@/lib/editor/editor-registry';
import {
    buildCatalogEditorSections,
    type ListingSectionStates
} from '@/lib/editor/listing-editor-registry';
import { ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY } from '@/lib/editor/listing-section-presentation';
import type { SupportedLocale } from '@/lib/i18n';

// Re-exported so the many call sites that reason in accommodation terms keep
// importing the types from here. The definitions live in `editor-registry.ts`
// since HOS-1080, where venue/experience reads them too.
export type { EditorSection, EditorSectionGroup };

/**
 * The visibility key of the one conditional accommodation section.
 *
 * Re-exported: it lives with the presentation of the section that declares it.
 */
export { ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY };

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * The catalog sections of an accommodation, in nav order, with none hidden.
 *
 * Accommodation has one rubro (`standard`) that offers every section, so the
 * resolver never marks one `absent`; this list therefore does not depend on the
 * owner. `locked` sections stay in (their treatment belongs to the page).
 *
 * Deliberately absent: the featured-listing toggle. It self-hides for every
 * owner without a live `FEATURED_LISTING` entitlement, so a nav item would
 * dead-end for the majority — it renders at the foot of the hub instead
 * (HOS-318 D-10, preserving the rationale from the pre-split editor).
 */
export const ACCOMMODATION_EDITOR_SECTIONS: readonly EditorSection[] = buildCatalogEditorSections({
    vertical: 'accommodation',
    sectionStates: {}
});

/** Group order for rendering, derived from first appearance in the registry. */
export const EDITOR_SECTION_GROUPS: readonly EditorSectionGroup[] = [
    'property',
    'content',
    'management'
] as const;

/** i18n key for each group heading. */
export const EDITOR_SECTION_GROUP_LABEL_KEYS: Readonly<Record<EditorSectionGroup, string>> = {
    property: 'host.properties.editor.group.property',
    content: 'host.properties.editor.group.content',
    management: 'host.properties.editor.group.management'
};

/**
 * The «Preguntas a la IA» page (HOS-2101).
 *
 * Deliberately NOT in {@link ACCOMMODATION_EDITOR_SECTIONS}: that list is the
 * domain catalog (DEC-FAC-033) — what a listing CONTAINS. This page edits nothing; it only reads the chat log, so it joins
 * the editor at the registry, right after the FAQs (its main action creates
 * one). The venue/experience editor does the same in `listing-editor-registry`.
 */
export const ACCOMMODATION_AI_QUESTIONS_SECTION: EditorSection = {
    id: 'aiQuestions',
    slug: 'preguntas-ia',
    group: 'content',
    labelKey: 'host.properties.editor.section.aiQuestions',
    // It creates FAQs one action at a time.
    saveModel: 'auto'
};

/**
 * The «Políticas» page (HOS-2123).
 *
 * The house rules used to sit at the foot of the services page (HOS-2060),
 * because the domain catalog puts `policies` in the `amenities` section. The
 * redesigned services page moved them to a page of their own, right after it.
 *
 * Deliberately NOT in {@link ACCOMMODATION_EDITOR_SECTIONS}, for the same
 * reason as {@link ACCOMMODATION_AI_QUESTIONS_SECTION}: that list is the
 * catalog, and the catalog has no such section — the
 * `policies` field still belongs to its `amenities` section, so the backend's
 * section detection and entitlement gating see exactly what they saw before.
 * This is a second editor ROUTE for that section's data, not a new section.
 */
export const ACCOMMODATION_POLICIES_SECTION: EditorSection = {
    id: 'policies',
    slug: 'politicas',
    group: 'property',
    labelKey: 'host.properties.editor.section.policies',
    saveModel: 'bar'
};

/**
 * Inserts `extra` right after the section with id `afterId`.
 *
 * @param params - The list, the anchor id and the section to insert.
 * @returns A new list; the input is never mutated.
 */
function insertAfter({
    sections,
    afterId,
    extra
}: {
    readonly sections: readonly EditorSection[];
    readonly afterId: string;
    readonly extra: EditorSection;
}): readonly EditorSection[] {
    const index = sections.findIndex((section) => section.id === afterId);
    return [...sections.slice(0, index + 1), extra, ...sections.slice(index + 1)];
}

/**
 * The editor's sections for one resolved state map: the catalog sections plus
 * the policies page (after the services page) and the AI questions page (after
 * the FAQs).
 *
 * @param params - The resolved section states (`{}` when none is `absent`).
 * @returns The ordered editor sections.
 */
export function buildAccommodationEditorSections({
    sectionStates
}: {
    readonly sectionStates: ListingSectionStates;
}): readonly EditorSection[] {
    return insertAfter({
        sections: insertAfter({
            sections: buildCatalogEditorSections({ vertical: 'accommodation', sectionStates }),
            afterId: 'amenities',
            extra: ACCOMMODATION_POLICIES_SECTION
        }),
        afterId: 'faqs',
        extra: ACCOMMODATION_AI_QUESTIONS_SECTION
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Builds the accommodation editor as an {@link EditorRegistry} (HOS-1080,
 * HOS-1809).
 *
 * This is what the shared nav / hub / breadcrumb machinery reads. The helpers
 * below keep their accommodation-flavoured signatures — thirty-odd call sites
 * say `accommodationId`, and renaming them would have been churn with no
 * behaviour behind it — but every one of them now resolves through this object,
 * so the paths are declared once.
 */
export function buildAccommodationEditorRegistry({
    sectionStates
}: {
    readonly sectionStates: ListingSectionStates;
}): EditorRegistry {
    return {
        id: 'accommodation',
        sections: buildAccommodationEditorSections({ sectionStates }),
        groups: EDITOR_SECTION_GROUPS,
        groupLabelKeys: EDITOR_SECTION_GROUP_LABEL_KEYS,
        indexPath: 'mi-cuenta/propiedades',
        indexLabelKey: 'host.properties.editor.breadcrumb.properties',
        buildHubPath: ({ entityId }) => `mi-cuenta/propiedades/${entityId}/editar`
    };
}

/** The registry every accommodation page reads; no section is ever `absent`. */
export const ACCOMMODATION_EDITOR_REGISTRY: EditorRegistry = buildAccommodationEditorRegistry({
    sectionStates: {}
});

/**
 * Translates the accommodation editor's one conditional flag into the
 * registry's visibility map.
 *
 * @param params - Whether translation data exists for this accommodation.
 * @returns The visibility answers for {@link ACCOMMODATION_EDITOR_REGISTRY}.
 */
export function buildAccommodationEditorVisibility({
    hasTranslations
}: {
    readonly hasTranslations: boolean;
}): Readonly<Record<string, boolean>> {
    return { [ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY]: hasTranslations };
}

/**
 * Finds a section by its URL slug.
 *
 * @param params - The slug to look up.
 * @returns The matching section, or `undefined` when the slug is unknown.
 */
export function findEditorSectionBySlug({
    slug
}: {
    readonly slug: string;
}): EditorSection | undefined {
    return findRegistrySectionBySlug({ registry: ACCOMMODATION_EDITOR_REGISTRY, slug });
}

/**
 * Builds the locale-prefixed, trailing-slashed URL for one editor section.
 *
 * @param params - Locale, accommodation id, and the target section.
 * @returns The absolute in-app path for that section's page.
 */
export function buildEditorSectionUrl({
    locale,
    accommodationId,
    section
}: {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly section: EditorSection;
}): string {
    return buildRegistrySectionUrl({
        locale,
        registry: ACCOMMODATION_EDITOR_REGISTRY,
        entityId: accommodationId,
        section
    });
}

/**
 * Builds the URL of the editor hub (`…/editar/`).
 *
 * The hub is a real page on every viewport, never a redirect to the first
 * section: redirecting traps the back button (section → hub → re-redirect), and
 * a back button that does not work is precisely the frustration this editor's
 * audience least tolerates (HOS-318 D-8).
 *
 * @param params - Locale and accommodation id.
 * @returns The absolute in-app path for the hub.
 */
export function buildEditorHubUrl({
    locale,
    accommodationId
}: {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}): string {
    return buildRegistryHubUrl({
        locale,
        registry: ACCOMMODATION_EDITOR_REGISTRY,
        entityId: accommodationId
    });
}

/**
 * Returns the sections that should be shown, dropping conditional ones whose
 * data is absent.
 *
 * @param params - Availability flags for the conditional sections.
 * @returns The visible sections, in registry order.
 */
export function getVisibleEditorSections({
    hasTranslations
}: {
    readonly hasTranslations: boolean;
}): readonly EditorSection[] {
    return getVisibleRegistrySections({
        registry: ACCOMMODATION_EDITOR_REGISTRY,
        visibility: buildAccommodationEditorVisibility({ hasTranslations })
    });
}

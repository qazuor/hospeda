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
 * Ordering is meaningful: entries are declared in nav order, and the nav renders
 * them grouped by `group` in the order the groups first appear here.
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
import type { SupportedLocale } from '@/lib/i18n';

// Re-exported so the many call sites that reason in accommodation terms keep
// importing the types from here. The definitions live in `editor-registry.ts`
// since HOS-1080, where commerce reads them too.
export type { EditorSection, EditorSectionGroup };

/**
 * The visibility key of the one conditional accommodation section.
 *
 * Named rather than inlined so the registry entry and every caller that answers
 * it (`hasTranslations`) are spelled the same in one place.
 */
export const ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY = 'translations';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * The ten editor sections, in nav order.
 *
 * Deliberately absent: the featured-listing toggle. It self-hides for every
 * owner without a live `FEATURED_LISTING` entitlement, so a nav item would
 * dead-end for the majority — it renders at the foot of the hub instead
 * (HOS-318 D-10, preserving the rationale from the pre-split editor).
 */
export const ACCOMMODATION_EDITOR_SECTIONS: readonly EditorSection[] = [
    {
        id: 'basicInfo',
        slug: 'datos',
        group: 'property',
        labelKey: 'host.properties.editor.section.basicInfo'
    },
    {
        id: 'capacityPricing',
        slug: 'capacidad-precio',
        group: 'property',
        // Not `section.capacity` — that key reads just "Capacidad", while this
        // page also owns the price fields.
        labelKey: 'host.properties.editor.section.capacityPricing'
    },
    {
        id: 'location',
        slug: 'ubicacion',
        group: 'property',
        labelKey: 'host.properties.editor.section.location'
    },
    {
        id: 'amenities',
        slug: 'servicios',
        group: 'property',
        labelKey: 'host.properties.editor.section.amenities'
    },
    {
        id: 'photos',
        slug: 'fotos',
        group: 'content',
        labelKey: 'host.properties.editor.section.photos'
    },
    {
        id: 'faqs',
        slug: 'preguntas',
        group: 'content',
        labelKey: 'host.properties.editor.section.faqs'
    },
    {
        id: 'contact',
        slug: 'contacto',
        group: 'content',
        // Not `section.contact` — this page absorbs the former standalone
        // "Redes sociales" section too, so the label has to cover both.
        labelKey: 'host.properties.editor.section.contactSocial'
    },
    {
        id: 'seo',
        slug: 'seo',
        group: 'content',
        // G7 smoke (H-121): no prior home for this — SEO is a distinct concern
        // from both the listing's own content (basicInfo/photos) and reaching
        // the host (contact), so it gets its own page rather than being folded
        // into either.
        labelKey: 'host.properties.editor.section.seo'
    },
    {
        id: 'calendar',
        slug: 'calendario',
        group: 'management',
        labelKey: 'host.properties.editor.section.calendar'
    },
    {
        id: 'translations',
        slug: 'traducciones',
        group: 'management',
        labelKey: 'host.properties.editor.translation.sectionTitle',
        visibilityKey: ACCOMMODATION_TRANSLATIONS_VISIBILITY_KEY
    },
    {
        id: 'externalReputation',
        slug: 'reputacion',
        group: 'management',
        labelKey: 'host.properties.editor.section.externalReputation'
    }
] as const;

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * The accommodation editor as an {@link EditorRegistry} (HOS-1080).
 *
 * This is what the shared nav / hub / breadcrumb machinery reads. The helpers
 * below keep their accommodation-flavoured signatures — thirty-odd call sites
 * say `accommodationId`, and renaming them would have been churn with no
 * behaviour behind it — but every one of them now resolves through this object,
 * so the paths are declared once.
 */
export const ACCOMMODATION_EDITOR_REGISTRY: EditorRegistry = {
    id: 'accommodation',
    sections: ACCOMMODATION_EDITOR_SECTIONS,
    groups: EDITOR_SECTION_GROUPS,
    groupLabelKeys: EDITOR_SECTION_GROUP_LABEL_KEYS,
    indexPath: 'mi-cuenta/propiedades',
    indexLabelKey: 'host.properties.editor.breadcrumb.properties',
    buildHubPath: ({ entityId }) => `mi-cuenta/propiedades/${entityId}/editar`
};

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

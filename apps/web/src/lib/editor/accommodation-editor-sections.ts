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

import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The three nav groups. Ten flat items force the reader to scan all ten to find
 * one; grouping cuts that to three headings. The same three-bucket shape the
 * account sidebar already uses (`account-nav__group`).
 */
export type EditorSectionGroup = 'property' | 'content' | 'management';

/** A single editor section — one entry, one route, one nav item, one hub row. */
export interface EditorSection {
    /** Stable identifier, used as the React key and by the foreign-import guard. */
    readonly id: string;
    /** URL segment under `…/editar/`. Spanish, matching the rest of the web app. */
    readonly slug: string;
    /** Which nav group this section belongs to. */
    readonly group: EditorSectionGroup;
    /** i18n key for the visible label. Reuses the pre-existing section keys. */
    readonly labelKey: string;
    /**
     * When true the section only appears once its data exists (translations).
     * The nav, the hub and the route itself all honour this — a nav item that
     * leads to an empty shell is worse than no nav item.
     */
    readonly conditional?: boolean;
}

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
        conditional: true
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
    return ACCOMMODATION_EDITOR_SECTIONS.find((section) => section.slug === slug);
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
    return buildUrl({
        locale,
        path: `mi-cuenta/propiedades/${accommodationId}/editar/${section.slug}`
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
    return buildUrl({ locale, path: `mi-cuenta/propiedades/${accommodationId}/editar` });
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
    return ACCOMMODATION_EDITOR_SECTIONS.filter((section) => {
        if (section.id === 'translations') return hasTranslations;
        return true;
    });
}

/**
 * @file editor-registry.ts
 * @description Vertical-agnostic core of the "one section, one page" editor
 * (HOS-1080).
 *
 * HOS-318 built this shape for accommodations: a registry of sections from which
 * the route nav, the hub list and the breadcrumbs are ALL derived, so a section
 * can never be reachable from one surface and missing from another. It worked,
 * and the owner's decision for HOS-1080 was to take it up rather than down —
 * gastronomy and experience get the same architecture instead of accommodation
 * losing it.
 *
 * What was in the way was not the shape but the WIRING: `EditorSection`,
 * `findEditorSectionBySlug` and the two URL builders all hard-coded
 * `mi-cuenta/propiedades/<id>/editar` and the word `accommodationId`. This module
 * holds the same logic with the accommodation-specific parts lifted into an
 * {@link EditorRegistry} the caller supplies.
 *
 * Nothing here knows about a vertical. `accommodation-editor-sections.ts` and
 * `commerce-editor-sections.ts` each declare one registry and the rest of the
 * editor reads only this file.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The three nav groups.
 *
 * Ten flat items force the reader to scan all ten to find one; grouping cuts
 * that to three headings. The same three-bucket shape the account sidebar
 * already uses (`account-nav__group`).
 *
 * The ids are deliberately generic even though `property` reads
 * accommodation-flavoured: they are internal bucket names, and the VISIBLE
 * heading of each comes from the registry's own
 * {@link EditorRegistry.groupLabelKeys}. So a restaurant's first group is
 * labelled "Tu ficha" while an accommodation's is "La propiedad", with no third
 * bucket id and no per-vertical union to keep in sync.
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
    /** i18n key for the visible label. */
    readonly labelKey: string;
    /**
     * When set, the section only appears once the named condition holds — see
     * {@link EditorSectionVisibility}. The nav, the hub and the route itself all
     * honour it: a nav item that leads to an empty shell is worse than no nav
     * item.
     *
     * Absent means "always visible", which is the common case.
     */
    readonly visibilityKey?: string;
}

/**
 * Runtime answers to every {@link EditorSection.visibilityKey} in a registry.
 *
 * Fails CLOSED: a key with no entry (or an explicit `false`) hides its section.
 * The alternative would surface a link the page cannot honour, which is the one
 * failure this whole registry exists to prevent.
 */
export type EditorSectionVisibility = Readonly<Record<string, boolean>>;

/**
 * One vertical's editor: its sections, its group headings, and where its pages
 * live.
 *
 * The two path members are locale-LESS in-app paths (no leading slash, no
 * trailing slash), because `buildUrl` owns the locale prefix and the trailing
 * slash for the whole app.
 */
export interface EditorRegistry {
    /** Stable id of the vertical, for test messages and debugging. */
    readonly id: string;
    /** The sections, in nav order. Groups render in {@link groups} order. */
    readonly sections: readonly EditorSection[];
    /** Group render order. A group with no visible section is skipped. */
    readonly groups: readonly EditorSectionGroup[];
    /** i18n key for each group heading. */
    readonly groupLabelKeys: Readonly<Record<EditorSectionGroup, string>>;
    /** Path of the owner's listing index, e.g. `mi-cuenta/propiedades`. */
    readonly indexPath: string;
    /** i18n key for the index's breadcrumb label, e.g. "Mis propiedades". */
    readonly indexLabelKey: string;
    /** Path of one entity's editor hub, e.g. `mi-cuenta/propiedades/<id>/editar`. */
    readonly buildHubPath: (params: { readonly entityId: string }) => string;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * Finds a section by its URL slug.
 *
 * @param params - The registry to search and the slug to look up.
 * @returns The matching section, or `undefined` when the slug is unknown.
 */
export function findEditorSectionBySlug({
    registry,
    slug
}: {
    readonly registry: EditorRegistry;
    readonly slug: string;
}): EditorSection | undefined {
    return registry.sections.find((section) => section.slug === slug);
}

/**
 * Decides whether one section appears at all.
 *
 * @param params - The section and the runtime visibility answers.
 * @returns True when the section should be listed.
 */
export function isEditorSectionVisible({
    section,
    visibility
}: {
    readonly section: EditorSection;
    readonly visibility: EditorSectionVisibility;
}): boolean {
    if (section.visibilityKey === undefined) return true;
    return visibility[section.visibilityKey] === true;
}

/**
 * Returns the sections that should be shown, dropping conditional ones whose
 * condition does not hold.
 *
 * @param params - The registry and the runtime visibility answers.
 * @returns The visible sections, in registry order.
 */
export function getVisibleEditorSections({
    registry,
    visibility
}: {
    readonly registry: EditorRegistry;
    readonly visibility: EditorSectionVisibility;
}): readonly EditorSection[] {
    return registry.sections.filter((section) => isEditorSectionVisible({ section, visibility }));
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/**
 * Builds the locale-less in-app path of one editor section.
 *
 * @param params - The registry, the entity id, and the target section.
 * @returns The path, with no locale prefix and no trailing slash.
 */
export function buildEditorSectionPath({
    registry,
    entityId,
    section
}: {
    readonly registry: EditorRegistry;
    readonly entityId: string;
    readonly section: EditorSection;
}): string {
    return `${registry.buildHubPath({ entityId })}/${section.slug}`;
}

/**
 * Builds the locale-prefixed, trailing-slashed URL for one editor section.
 *
 * @param params - Locale, registry, entity id, and the target section.
 * @returns The absolute in-app path for that section's page.
 */
export function buildEditorSectionUrl({
    locale,
    registry,
    entityId,
    section
}: {
    readonly locale: SupportedLocale;
    readonly registry: EditorRegistry;
    readonly entityId: string;
    readonly section: EditorSection;
}): string {
    return buildUrl({ locale, path: buildEditorSectionPath({ registry, entityId, section }) });
}

/**
 * Builds the URL of the editor hub (`…/editar/`).
 *
 * The hub is a real page on every viewport, never a redirect to the first
 * section: redirecting traps the back button (section → hub → re-redirect), and
 * a back button that does not work is precisely the frustration this editor's
 * audience least tolerates (HOS-318 D-8).
 *
 * @param params - Locale, registry and entity id.
 * @returns The absolute in-app path for the hub.
 */
export function buildEditorHubUrl({
    locale,
    registry,
    entityId
}: {
    readonly locale: SupportedLocale;
    readonly registry: EditorRegistry;
    readonly entityId: string;
}): string {
    return buildUrl({ locale, path: registry.buildHubPath({ entityId }) });
}

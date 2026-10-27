/**
 * @file gastronomy-editor-sections.ts
 * @description Section registry for the gastronomy editor, the counterpart of
 * `accommodation-editor-sections.ts` (HOS-1080).
 *
 * Built as a function because the hub path carries the vertical and because the
 * gastronomy-only sections (carta, menú del día, eventos) must be ABSENT from
 * the experience registry rather than hidden: `findEditorSectionBySlug` then
 * returns `undefined` for them and the shared resolver sends the unknown slug
 * to the hub. Shared pieces live in `listing-editor-sections.ts`.
 */

import type { EditorRegistry, EditorSection } from '@/lib/editor/editor-registry';
import {
    createListingEditorRegistry,
    LISTING_SHARED_EDITOR_SECTIONS
} from '@/lib/editor/listing-editor-sections';

/**
 * Sections that exist only on the gastronomy vertical (HOS-895, HOS-1042).
 *
 * The mirror of `EXPERIENCE_ONLY_SECTIONS` in `experience-editor-sections.ts`, and left out of the
 * experience registry for the same reason those two are left out of the
 * gastronomy one: an experience has no carta and no venue agenda, so the
 * sections do not exist for it rather than being hidden from it.
 * `findEditorSectionBySlug` returns `undefined` for both
 * `/experience/<id>/editar/carta` and `/experience/<id>/editar/eventos`, and
 * the shared resolver sends either to the hub — no `visibilityKey`, matching
 * the file's rule that no section here uses a runtime one.
 *
 * Both entries sit in the `content` group rather than next to `precio`: each
 * is authored content, and structurally each is the twin of `preguntas` — a
 * self-persisting manager with its own endpoints, repeatable rows, mounted
 * bare with no form and no save button. `precio` holds the price TIER and the
 * external menu link, which are listing attributes. The "where it rendered
 * pre-split" rule that places the experience-only pair does not apply: both
 * panels are new (HOS-895, HOS-1042), so no owner has an existing expectation
 * to preserve.
 *
 * This array now holds two entries. `buildGastronomyEditorSections` below
 * splices the whole block in via spread (`...GASTRONOMY_ONLY_SECTIONS`), so
 * that keeps working unchanged regardless of how many entries this array
 * carries — both land just before `preguntas`, in declaration order (`carta`
 * then `eventos`).
 */
const GASTRONOMY_ONLY_SECTIONS: readonly EditorSection[] = [
    {
        id: 'menu',
        slug: 'carta',
        group: 'content',
        labelKey: 'listing.owner.editor.sectionNav.menu'
    },
    // HOS-1041 — the menú del día, immediately after the carta it is adjacent
    // to in meaning: the carta is what the venue cooks all year, this is what
    // it is cooking today. Same `content` group and same structure (a
    // self-persisting manager with its own endpoints and no save button), and
    // gastronomy-only for the same reason — an experience has no plato del día.
    //
    // No `visibilityKey`, matching this file's rule. The tier is enforced by
    // the API on the WRITE; the page itself must stay reachable on every
    // gastronomy tier so a `-basico` owner sees the panel and its upsell rather
    // than a nav that silently lacks an entry.
    {
        id: 'dailySpecials',
        slug: 'menu-del-dia',
        group: 'content',
        labelKey: 'listing.owner.editor.sectionNav.dailySpecials'
    },
    {
        id: 'venueEvents',
        slug: 'eventos',
        group: 'content',
        labelKey: 'listing.owner.editor.sectionNav.venueEvents'
    }
];

/**
 * Builds the gastronomy section list, in nav order.
 *
 * The carta, menú del día and eventos sit just before `preguntas`, its
 * structural twin in the `content` group (HOS-895).
 *
 * @returns The gastronomy sections.
 */
export function buildGastronomyEditorSections(): readonly EditorSection[] {
    const faqsIndex = LISTING_SHARED_EDITOR_SECTIONS.findIndex((section) => section.id === 'faqs');
    return faqsIndex === -1
        ? [...LISTING_SHARED_EDITOR_SECTIONS, ...GASTRONOMY_ONLY_SECTIONS]
        : [
              ...LISTING_SHARED_EDITOR_SECTIONS.slice(0, faqsIndex),
              ...GASTRONOMY_ONLY_SECTIONS,
              ...LISTING_SHARED_EDITOR_SECTIONS.slice(faqsIndex)
          ];
}

/**
 * Builds the editor registry for a gastronomy listing.
 *
 * @returns The registry the shared nav / hub / breadcrumb machinery reads.
 */
export function buildGastronomyEditorRegistry(): EditorRegistry {
    return createListingEditorRegistry({
        vertical: 'gastronomy',
        sections: buildGastronomyEditorSections()
    });
}

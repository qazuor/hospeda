/**
 * @file commerce-editor-sections.ts
 * @description Section registry for the gastronomy and experience editors
 * (HOS-1080, closing HOS-892).
 *
 * The commerce editor used to be ONE route rendering every field group as an
 * anchor on a single page, while the accommodation editor had thirteen routes.
 * HOS-892 reported the symptom of that ("un formulario larguísimo sin
 * encabezados"); the owner's decision was to level up rather than down, so this
 * file is the commerce counterpart of `accommodation-editor-sections.ts` and the
 * nav, the hub and the breadcrumbs all derive from it.
 *
 * ## One registry per vertical, built at call time
 *
 * `buildCommerceEditorRegistry` is a function, not a constant, for two reasons
 * that both matter:
 *
 * 1. **The hub path carries the vertical** (`mi-cuenta/comercio/<vertical>/…`),
 *    so a registry that did not know it could not build a single URL.
 * 2. **Two sections exist only for experiences.** `meetingPoint` and
 *    `practicalInfo` are gated by the SHAPE of the schema — their keys live on
 *    `ExperienceOwnerUpdateInputSchema` and not on the gastronomy one — so for a
 *    restaurant they are not "hidden", they do not exist. Leaving them out of
 *    the registry entirely means `findEditorSectionBySlug` returns `undefined`
 *    for `/gastronomy/<id>/editar/punto-de-encuentro`, and the shared resolver
 *    already sends an unknown slug to the hub. A `visibilityKey` would have hidden
 *    the nav item while leaving the route renderable, which is the weaker answer.
 *
 * No section here uses a runtime `visibilityKey`. The amenities page was the
 * candidate — `AmenitiesSection` renders nothing when both catalogs come back
 * empty — but answering that on the nav would mean fetching both catalogs on
 * ALL eleven pages to decide whether to draw one link. The accommodation editor
 * makes the same trade (its `servicios` entry is unconditional and only its own
 * route fetches the catalog); the `servicios` route below carries the empty-
 * catalog case as a visible notice instead, which is a better answer than a
 * silently missing nav item anyway.
 */

import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import type { EditorRegistry, EditorSection } from '@/lib/editor/editor-registry';

/** Sections every commerce vertical has, in nav order. */
const SHARED_SECTIONS: readonly EditorSection[] = [
    {
        id: 'basicInfo',
        slug: 'datos',
        group: 'property',
        labelKey: 'commerce.owner.editor.sectionNav.basicInfo'
    },
    {
        id: 'openingHours',
        slug: 'horarios',
        group: 'property',
        labelKey: 'commerce.owner.editor.sectionNav.openingHours'
    },
    {
        id: 'price',
        slug: 'precio',
        group: 'property',
        labelKey: 'commerce.owner.editor.sectionNav.price'
    },
    {
        id: 'amenities',
        slug: 'servicios',
        group: 'property',
        labelKey: 'commerce.owner.editor.sectionNav.amenities'
    },
    {
        id: 'media',
        slug: 'fotos',
        group: 'content',
        labelKey: 'commerce.owner.editor.sectionNav.media'
    },
    {
        id: 'contact',
        slug: 'contacto',
        group: 'content',
        // Not `sectionNav.contactInfo` — this page absorbs the former standalone
        // "Redes sociales" section too, exactly as the accommodation editor's
        // `contacto` page does, so the label has to cover both.
        labelKey: 'commerce.owner.editor.sectionNav.contactSocial'
    },
    {
        id: 'faqs',
        slug: 'preguntas',
        group: 'content',
        labelKey: 'commerce.owner.editor.sectionNav.faqs'
    },
    {
        id: 'translations',
        slug: 'traducciones',
        group: 'management',
        labelKey: 'commerce.owner.editor.sectionNav.translations'
    }
];

/**
 * Sections that exist only on the gastronomy vertical (HOS-895).
 *
 * The mirror of {@link EXPERIENCE_ONLY_SECTIONS}, and left out of the
 * experience registry for the same reason those two are left out of the
 * gastronomy one: an experience has no carta, so the section does not exist
 * for it rather than being hidden from it. `findEditorSectionBySlug` returns
 * `undefined` for `/experience/<id>/editar/carta` and the shared resolver
 * sends it to the hub — no `visibilityKey`, matching the file's rule that no
 * section here uses a runtime one.
 *
 * In the `content` group rather than next to `precio`: the carta is authored
 * content, and structurally it is the twin of `preguntas` — a self-persisting
 * manager with its own endpoints, repeatable rows, mounted bare with no form
 * and no save button. `precio` holds the price TIER and the external menu
 * link, which are listing attributes. The "where it rendered pre-split" rule
 * that places the experience-only pair does not apply: this panel is new in
 * HOS-895, so no owner has an existing expectation to preserve.
 */
const GASTRONOMY_ONLY_SECTIONS: readonly EditorSection[] = [
    {
        id: 'menu',
        slug: 'carta',
        group: 'content',
        labelKey: 'commerce.owner.editor.sectionNav.menu'
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
        labelKey: 'commerce.owner.editor.sectionNav.dailySpecials'
    }
];

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
        labelKey: 'commerce.owner.editor.sectionNav.meetingPoint'
    },
    {
        id: 'practicalInfo',
        slug: 'datos-practicos',
        group: 'property',
        labelKey: 'commerce.owner.editor.sectionNav.practicalInfo'
    }
];

/** Group order for rendering. */
export const COMMERCE_EDITOR_SECTION_GROUPS = ['property', 'content', 'management'] as const;

/**
 * i18n key for each group heading.
 *
 * The bucket ids are shared with the accommodation editor (see
 * `EditorSectionGroup`); only the visible headings differ, which is the whole
 * reason the labels live on the registry rather than on the type.
 */
export const COMMERCE_EDITOR_GROUP_LABEL_KEYS = {
    property: 'commerce.owner.editor.group.listing',
    content: 'commerce.owner.editor.group.content',
    management: 'commerce.owner.editor.group.management'
} as const;

/**
 * Builds the section list for one vertical, in nav order.
 *
 * @param params - The vertical whose editor is being rendered.
 * @returns The sections, experience-only entries included only for experiences.
 */
export function buildCommerceEditorSections({
    vertical
}: {
    readonly vertical: CommerceVertical;
}): readonly EditorSection[] {
    if (vertical !== 'experience') {
        // HOS-895: the carta sits just before `preguntas`, its structural twin
        // in the `content` group.
        const faqsIndex = SHARED_SECTIONS.findIndex((section) => section.id === 'faqs');
        return faqsIndex === -1
            ? [...SHARED_SECTIONS, ...GASTRONOMY_ONLY_SECTIONS]
            : [
                  ...SHARED_SECTIONS.slice(0, faqsIndex),
                  ...GASTRONOMY_ONLY_SECTIONS,
                  ...SHARED_SECTIONS.slice(faqsIndex)
              ];
    }

    const [basicInfo, ...rest] = SHARED_SECTIONS;
    // `SHARED_SECTIONS` is a non-empty literal, so `basicInfo` is always defined;
    // the guard exists because TypeScript cannot see that through `readonly[]`.
    return basicInfo ? [basicInfo, ...EXPERIENCE_ONLY_SECTIONS, ...rest] : SHARED_SECTIONS;
}

/**
 * Builds the editor registry for one commerce listing's vertical.
 *
 * @param params - The vertical whose editor is being rendered.
 * @returns The registry the shared nav / hub / breadcrumb machinery reads.
 */
export function buildCommerceEditorRegistry({
    vertical
}: {
    readonly vertical: CommerceVertical;
}): EditorRegistry {
    return {
        id: vertical,
        sections: buildCommerceEditorSections({ vertical }),
        groups: COMMERCE_EDITOR_SECTION_GROUPS,
        groupLabelKeys: COMMERCE_EDITOR_GROUP_LABEL_KEYS,
        indexPath: 'mi-cuenta/comercio',
        indexLabelKey: 'commerce.owner.editor.breadcrumb.listings',
        buildHubPath: ({ entityId }) => `mi-cuenta/comercio/${vertical}/${entityId}/editar`
    };
}

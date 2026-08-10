/**
 * @file editor-breadcrumbs-model.ts
 * @description Builds the breadcrumb input for the editor pages (HOS-318 T-009).
 *
 * This does NOT render a trail. Rendering belongs to the shared
 * `components/shared/navigation/Breadcrumbs.astro`, which the whole site already
 * uses — an editor-specific breadcrumb component would have been a second
 * convention with its own styling, drifting from the first.
 *
 * That component's contract, which this function feeds:
 *  - the caller passes the FULL trail with the current page LAST,
 *  - it drops the current page (already the page's `<h1>`),
 *  - it prepends "Inicio" itself.
 *
 * So `Mis propiedades › Casa del Sol › Fotos` renders as
 * `Inicio › Mis propiedades › Casa del Sol`.
 */

import type { BreadcrumbInputItem } from '@/lib/navigation/breadcrumb-trail';

/**
 * Builds the editor's breadcrumb trail input.
 *
 * @param params - Accommodation identity, the active section, and the resolved
 * labels (resolved by the caller, which owns the `t` function).
 * @returns The full trail, current page last, for `Breadcrumbs.astro`.
 */
export function buildEditorBreadcrumbItems({
    accommodationId,
    accommodationName,
    currentSectionSlug,
    propertiesLabel,
    sectionLabel
}: {
    readonly accommodationId: string;
    readonly accommodationName: string;
    /** `null` on the hub, where the accommodation itself is the current page. */
    readonly currentSectionSlug: string | null;
    readonly propertiesLabel: string;
    /** Label of the current section. Ignored on the hub. */
    readonly sectionLabel: string;
}): readonly BreadcrumbInputItem[] {
    const items: BreadcrumbInputItem[] = [
        { label: propertiesLabel, path: 'mi-cuenta/propiedades' }
    ];

    if (currentSectionSlug === null) {
        // On the hub the accommodation IS the current page, so it is the last
        // item — the shared component drops it and the visible trail ends at
        // "Mis propiedades".
        items.push({ label: accommodationName });
        return items;
    }

    items.push({
        label: accommodationName,
        path: `mi-cuenta/propiedades/${accommodationId}/editar`
    });
    items.push({ label: sectionLabel });

    return items;
}

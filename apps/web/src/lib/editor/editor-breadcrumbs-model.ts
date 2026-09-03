/**
 * @file editor-breadcrumbs-model.ts
 * @description Builds the breadcrumb input for the editor pages (HOS-318 T-009,
 * generalized across verticals in HOS-1080).
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
 *
 * The two paths in the trail come from the registry rather than being written
 * here, which is what lets a restaurant produce `Mis comercios › El Faro ›
 * Fotos` through the same function.
 */

import type { EditorRegistry } from '@/lib/editor/editor-registry';
import type { BreadcrumbInputItem } from '@/lib/navigation/breadcrumb-trail';

/**
 * Builds the editor's breadcrumb trail input.
 *
 * @param params - The vertical's registry, the entity's identity, the active
 * section, and the resolved labels (resolved by the caller, which owns the `t`
 * function).
 * @returns The full trail, current page last, for `Breadcrumbs.astro`.
 */
export function buildEditorBreadcrumbItems({
    registry,
    entityId,
    entityName,
    currentSectionSlug,
    indexLabel,
    sectionLabel
}: {
    readonly registry: EditorRegistry;
    readonly entityId: string;
    readonly entityName: string;
    /** `null` on the hub, where the entity itself is the current page. */
    readonly currentSectionSlug: string | null;
    /** Label of the owner's listing index, e.g. "Mis propiedades". */
    readonly indexLabel: string;
    /** Label of the current section. Ignored on the hub. */
    readonly sectionLabel: string;
}): readonly BreadcrumbInputItem[] {
    const items: BreadcrumbInputItem[] = [{ label: indexLabel, path: registry.indexPath }];

    if (currentSectionSlug === null) {
        // On the hub the entity IS the current page, so it is the last item —
        // the shared component drops it and the visible trail ends at the
        // listing index.
        items.push({ label: entityName });
        return items;
    }

    items.push({
        label: entityName,
        path: registry.buildHubPath({ entityId })
    });
    items.push({ label: sectionLabel });

    return items;
}

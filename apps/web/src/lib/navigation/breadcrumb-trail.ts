/**
 * @file breadcrumb-trail.ts
 * @description Pure trail-building logic for the shared Breadcrumbs component.
 *
 * Extracted from `Breadcrumbs.astro` so the behaviour is unit-testable: Astro
 * components cannot be rendered in Vitest, so any logic left in the template can
 * only be asserted by reading its source text.
 *
 * Two rules live here:
 *
 * 1. **The current page is dropped.** Callers pass the full trail (last item =
 *    current page) because the `BreadcrumbList` JSON-LD needs it complete, but
 *    the visible trail ends at the parent: on a detail page the leaf label is
 *    already the `<h1>` immediately below, so rendering it twice adds length
 *    without adding hierarchy.
 * 2. **A trail with nothing but "Inicio" is not rendered.** Top-level listings
 *    (`/alojamientos/`, `/eventos/`, …) pass a single item which IS the current
 *    page; once dropped only the home link remains, which carries no hierarchy.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** A caller-supplied breadcrumb level. */
export interface BreadcrumbInputItem {
    /** Display label for this level. */
    readonly label: string;
    /**
     * Path after the locale prefix (e.g. `alojamientos`). Omit for levels that
     * have no page of their own (e.g. the "Autor" grouping level) — those render
     * as plain text instead of links.
     */
    readonly path?: string;
}

/** A resolved level ready to render. */
export interface BreadcrumbTrailEntry {
    /** Display label for this level. */
    readonly label: string;
    /** Resolved href, or `undefined` when this level has no page of its own. */
    readonly href?: string;
}

interface BuildBreadcrumbTrailInput {
    /** Full trail excluding home, last item being the current page. */
    readonly items: readonly BreadcrumbInputItem[];
    /** Active locale, used to prefix every href. */
    readonly locale: SupportedLocale;
    /** Localized label for the home level. */
    readonly homeLabel: string;
}

interface BuildBreadcrumbTrailResult {
    /** Levels to render, home first. Empty when the trail carries no hierarchy. */
    readonly entries: readonly BreadcrumbTrailEntry[];
}

/**
 * Build the visible breadcrumb trail from the full trail.
 *
 * @param input - Trail input.
 * @param input.items - Full trail excluding home, last item being the current page.
 * @param input.locale - Active locale, used to prefix every href.
 * @param input.homeLabel - Localized label for the home level.
 * @returns An object with `entries`: the levels to render, home first. Empty
 * when only the home level would remain.
 *
 * @example
 * ```ts
 * buildBreadcrumbTrail({
 *   items: [{ label: 'Publicaciones', path: 'publicaciones' }, { label: 'Fiesta…' }],
 *   locale: 'es',
 *   homeLabel: 'Inicio',
 * });
 * // { entries: [
 * //     { label: 'Inicio', href: '/es/' },
 * //     { label: 'Publicaciones', href: '/es/publicaciones/' },
 * //   ] }
 * ```
 */
export function buildBreadcrumbTrail({
    items,
    locale,
    homeLabel
}: BuildBreadcrumbTrailInput): BuildBreadcrumbTrailResult {
    // Drop the current page: it is already the page's own <h1>.
    const ancestors = items.slice(0, -1);

    // Home alone is not a trail.
    if (ancestors.length === 0) {
        return { entries: [] };
    }

    const entries: BreadcrumbTrailEntry[] = [
        { label: homeLabel, href: buildUrl({ locale, path: '' }) }
    ];

    for (const item of ancestors) {
        entries.push({
            label: item.label,
            // A missing `path` means "no page of its own" — it must NOT fall back
            // to `''`, which would silently link the level to the homepage.
            href: item.path === undefined ? undefined : buildUrl({ locale, path: item.path })
        });
    }

    return { entries };
}

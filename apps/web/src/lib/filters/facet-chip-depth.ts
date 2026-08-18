/**
 * @file facet-chip-depth.ts
 * @description The depth cap for multi-select quick-filter chip rows — the
 * second half of the HOS-524 crawler-trap fix (the first half is the canonical
 * ordering in `canonical-facet-order.ts`).
 *
 * Why this exists: every already-filtered listing re-emitted an `<a>` per
 * remaining value, each linking one value DEEPER. `?types=CABIN` published
 * twelve `?types=CABIN,<X>` links, each of which published eleven more, and so
 * on — the full subset lattice of the facet, published as real links by the
 * page itself. Capping the ADD affordance at
 * {@link FACET_CHIP_MAX_ACTIVE_VALUES} bounds each facet to the subsets of
 * size <= N.
 *
 * Counted over the chips each page ACTUALLY emits, which is not the size of
 * the backing enum: eventos and publicaciones render hardcoded rows of 8
 * (`CATEGORY_CHIP_DEFS` / `POST_CATEGORY_CHIP_DEFS`) against enums of 9 and
 * 18, and destinos' badges are DB-driven (45 today, the union of attractions
 * across every loaded destination).
 *
 * | facet          | chips | canonical only | capped at 3 |
 * |----------------|-------|----------------|-------------|
 * | accommodations |    13 |          8.192 |         377 |
 * | events         |     8 |            256 |          92 |
 * | blog           |     8 |            256 |          92 |
 * | destinos       |    45 |       ~3,5e+13 |      15.225 |
 *
 * **What the cap does NOT do.** It never blocks REMOVING a value: an active
 * chip keeps its href at any depth, so a crafted deep URL is always exitable
 * (both for a user and for a crawler that landed on one). And it caps only the
 * chip row — the `FilterSidebar` island keeps unlimited multi-select, because
 * it navigates via JavaScript and publishes no links for a crawler to follow.
 * The cap is a limit on the LINK GRAPH, not on what a user may filter by.
 *
 * `rel="nofollow"` (`facet-crawl-policy.ts`) and the `robots.txt` disallows stay
 * exactly as they are: they stop every crawler that obeys them, and this cap is
 * what bounds the damage from the ones that do not.
 */

import { buildMultiToggleParamHref } from './toggle-multi-query-param';

/**
 * Maximum number of simultaneously active values a chip row will offer to GROW
 * to. Owner decision (HOS-524, 2026-08-17): **3**.
 *
 * Rationale: nobody narrows a listing by 4 of 13 accommodation types, the
 * shared SEO predicate already marks anything with 2+ active values
 * `noindex,follow` (`promoted-facet-canonical.ts`), so no capped-away URL was
 * ever indexable surface, and the `FilterSidebar` remains available for a
 * deeper selection.
 */
export const FACET_CHIP_MAX_ACTIVE_VALUES = 3;

interface ResolveFacetChipHrefParams {
    /** Canonical listing base URL (trailing slash, no query string). */
    readonly baseUrl: string;
    /** Current URL search params — source of truth for every OTHER active filter/sort. */
    readonly searchParams: URLSearchParams;
    /** Array query param key for this facet (e.g. `'types'`, `'categories'`). */
    readonly key: string;
    /** The value this chip toggles. */
    readonly value: string;
    /** The facet's legacy scalar query param, when it has one (e.g. `'type'`). */
    readonly singularKey?: string;
    /**
     * The facet's currently active values — normally the page's already-hoisted
     * `readFacetActiveValues` result, so the chip row and the SEO decision read
     * the same set instead of recomputing it per chip.
     */
    readonly activeValues: readonly string[];
}

/**
 * Resolve a quick-filter chip's href, or `undefined` when this chip would grow
 * the selection past {@link FACET_CHIP_MAX_ACTIVE_VALUES}.
 *
 * A chip that gets `undefined` must render as a non-interactive element (see
 * `FilterChips.astro`, which renders a `<span aria-disabled="true">` for a
 * chip with no href) — NOT as an `<a>` with a dead href, and NOT silently
 * dropped, which would make the row's contents shift under the user.
 *
 * @param params - See {@link ResolveFacetChipHrefParams}.
 * @returns The toggle href, or `undefined` when the ADD is capped.
 *
 * @example
 * ```ts
 * resolveFacetChipHref({
 *   baseUrl: '/es/alojamientos/',
 *   searchParams: new URLSearchParams('types=APARTMENT,CABIN,HOTEL'),
 *   key: 'types',
 *   value: 'ROOM',
 *   activeValues: ['APARTMENT', 'CABIN', 'HOTEL']
 * });
 * // undefined — three values are already active
 * ```
 */
export function resolveFacetChipHref({
    baseUrl,
    searchParams,
    key,
    value,
    singularKey,
    activeValues
}: ResolveFacetChipHrefParams): string | undefined {
    const removes = activeValues.includes(value);
    if (!removes && activeValues.length >= FACET_CHIP_MAX_ACTIVE_VALUES) {
        return undefined;
    }
    return buildMultiToggleParamHref({ baseUrl, searchParams, key, value, singularKey });
}

interface ResolveCappedChipNoteParams {
    /** Whether this chip's value is currently active (an active chip is never capped). */
    readonly active: boolean;
    /** How many values of this facet are currently active. */
    readonly activeCount: number;
    /**
     * Raw i18n templates with a literal `{{count}}` placeholder
     * (`t('common.filterChips.cappedNote_one' | '..._other')`), interpolated
     * here — the same framework-agnostic convention `buildClearFacetChip`
     * uses, which keeps this module free of any i18n dependency.
     *
     * BOTH forms are required even though the singular is unreachable at the
     * current cap of 3. {@link FACET_CHIP_MAX_ACTIVE_VALUES} is presented as an
     * owner-tunable number, and a caller that hardcoded the plural would start
     * announcing "already 1 filters active" the day it drops to 1.
     */
    readonly oneTemplate: string;
    readonly otherTemplate: string;
}

/**
 * Build the screen-reader note for a chip the depth cap has made inert, or
 * `undefined` for a chip that is still interactive.
 *
 * Rendered as visually-hidden text INSIDE the chip (see `FilterChips.astro`),
 * never as an `aria-label` on it: a capped chip is a `<span>` with no `role`,
 * whose implicit role is `generic`, and ARIA prohibits naming a `generic`
 * element — the label would simply not be computed, and axe flags it
 * (`aria-prohibited-attr`). The note therefore excludes the chip's own label,
 * which the visible text already provides.
 *
 * Without it, the only signal that the row stopped accepting new values is a
 * change in opacity, which conveys nothing to a screen reader.
 *
 * @param params - See {@link ResolveCappedChipNoteParams}.
 * @returns The interpolated note, or `undefined` when not capped.
 */
export function resolveCappedChipNote({
    active,
    activeCount,
    oneTemplate,
    otherTemplate
}: ResolveCappedChipNoteParams): string | undefined {
    if (active || activeCount < FACET_CHIP_MAX_ACTIVE_VALUES) {
        return undefined;
    }
    const template = activeCount === 1 ? oneTemplate : otherTemplate;
    return template.replace(/\{\{count\}\}/g, String(activeCount));
}

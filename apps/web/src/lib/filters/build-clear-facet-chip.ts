/**
 * @file build-clear-facet-chip.ts
 * @description Shared, standalone builder for the "Clear (N)" bulk-reset
 * quick-filter chip (HOS-96 US-4 / T-010). Given the current active-value
 * count of a multi-select facet, returns a chip-shaped object whose `href`
 * removes the WHOLE facet array param (preserving every other query param
 * and always dropping `page`, mirroring `buildMultiToggleParamHref`'s own
 * param-preservation approach) — or `undefined` when fewer than 2 values are
 * active, since the bulk-clear affordance only makes sense once there is more
 * than one value to clear (a single active value is already removable by
 * re-clicking its own chip, per US-3).
 *
 * Framework/i18n agnostic by design so it stays trivially self-contained and
 * unit-testable: the caller resolves `labelTemplate` / `ariaLabelTemplate`
 * via `t()` WITHOUT interpolating `count` (e.g.
 * `t('common.filterChips.clearLabel')` → the raw `"Limpiar ({{count}})"`
 * string, placeholder intact), and this helper performs the `{{count}}`
 * substitution itself, mirroring the same `{{param}}` interpolation
 * convention `apps/web/src/lib/i18n.ts`'s `resolve()` already uses. This
 * keeps the helper free of any `@repo/i18n`/`@/lib/i18n` dependency.
 *
 * NOT wired into any listing page yet — that lands in T-011/12/13, which
 * will also switch the per-value chip hrefs to the multi-value toggle and
 * append this chip to each page's `chips` array.
 */

import type { IconProps } from '@repo/icons';
import type { ComponentType } from 'react';

interface BuildClearFacetChipParams {
    /** Canonical listing base URL (trailing slash, no query string). */
    readonly baseUrl: string;
    /** Current URL search params — source of truth for every OTHER active filter/sort. */
    readonly searchParams: URLSearchParams;
    /** Array query param key to clear entirely (e.g. `'types'`, `'categories'`). */
    readonly paramKey: string;
    /**
     * Number of currently active values for this facet (e.g.
     * `readFacetActiveValues({ searchParams, paramKey }).length`, typically
     * already computed by the caller for the per-value chip active state).
     * Fewer than 2 → no chip (`undefined`).
     */
    readonly count: number;
    /** Raw i18n chip label template containing a literal `{{count}}` placeholder (e.g. `"Limpiar ({{count}})"`). */
    readonly labelTemplate: string;
    /** Raw i18n accessible-name template containing a literal `{{count}}` placeholder (e.g. `"Limpiar {{count}} filtros"`). */
    readonly ariaLabelTemplate: string;
    /** Leading icon component for the chip (already resolved by the caller, e.g. `XCircleIcon` from `@repo/icons`). */
    readonly icon: ComponentType<IconProps>;
}

/**
 * The "Clear (N)" chip's shape — a superset-compatible subset of
 * `FilterChips.astro`'s `ChipItem` (`label`, `href`, `active`, `ariaLabel`,
 * `icon`), so callers can spread the result directly into a `chips` array.
 */
export interface ClearFacetChip {
    /** Visible chip label, count already interpolated (e.g. `"Limpiar (2)"`). */
    readonly label: string;
    /** Href that removes the whole facet param, preserving every other param, dropping `page`. */
    readonly href: string;
    /** Always `false` — this is an action chip, not a selected-value indicator. */
    readonly active: false;
    /** Accessible name, count already interpolated (e.g. `"Limpiar 2 filtros"`). */
    readonly ariaLabel: string;
    /** Leading icon component, passed through unchanged. */
    readonly icon: ComponentType<IconProps>;
}

/** Replace every literal `{{count}}` placeholder in a template with the resolved count. */
function interpolateCount(template: string, count: number): string {
    return template.replace(/\{\{count\}\}/g, String(count));
}

/**
 * Build the "Clear (N)" bulk-reset chip for a multi-select facet, or
 * `undefined` when fewer than 2 values are currently active.
 *
 * @param params - See {@link BuildClearFacetChipParams}.
 * @returns The chip, or `undefined` when `count < 2`.
 *
 * @example
 * ```ts
 * buildClearFacetChip({
 *   baseUrl: '/es/alojamientos/',
 *   searchParams: new URLSearchParams('types=HOTEL,CABIN'),
 *   paramKey: 'types',
 *   count: 2,
 *   labelTemplate: 'Limpiar ({{count}})',
 *   ariaLabelTemplate: 'Limpiar {{count}} filtros',
 *   icon: XCircleIcon
 * });
 * // { label: 'Limpiar (2)', href: '/es/alojamientos/', active: false, ariaLabel: 'Limpiar 2 filtros', icon: XCircleIcon }
 * ```
 */
export function buildClearFacetChip({
    baseUrl,
    searchParams,
    paramKey,
    count,
    labelTemplate,
    ariaLabelTemplate,
    icon
}: BuildClearFacetChipParams): ClearFacetChip | undefined {
    if (count < 2) {
        return undefined;
    }

    const params = new URLSearchParams(searchParams);
    params.delete('page');
    params.delete(paramKey);
    const qs = params.toString();
    const href = qs ? `${baseUrl}?${qs}` : baseUrl;

    return {
        label: interpolateCount(labelTemplate, count),
        href,
        active: false,
        ariaLabel: interpolateCount(ariaLabelTemplate, count),
        icon
    };
}

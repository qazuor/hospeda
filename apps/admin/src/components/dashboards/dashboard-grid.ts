/**
 * Dashboard bento-grid helpers — SPEC-155 redesign.
 *
 * Maps a {@link GridSpan} (config-driven on each widget) to the Tailwind class
 * string applied to the per-widget wrapper inside the dashboard grid.
 *
 * ## Responsive contract
 *
 * - **mobile** (`grid-cols-1`): every widget collapses to 1×1. Spans are ignored.
 * - **md** (`grid-cols-2`): `cols` is capped at 2 so a 3-col hero degrades to 2.
 *   Row spans (1 / 2) are preserved.
 * - **lg** (`grid-cols-3`): full span applied as configured.
 *
 * ## Why lookup tables (not interpolated class names)
 *
 * Tailwind v4's content scanner only keeps classes that appear *literally* in
 * source files. A string like `` `lg:col-span-${cols}` `` would be purged at
 * build time, so each possible class must appear as a literal token here.
 *
 * @module dashboards/dashboard-grid
 */

import type { GridSpan } from '@/config/ia/schema';

/**
 * Tailwind `md:col-span-*` lookup table.
 *
 * The md grid has 2 columns; a configured `cols: 3` degrades to `md:col-span-2`.
 */
const MD_COL_SPAN: Record<1 | 2 | 3, string> = {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-2'
};

/**
 * Tailwind `lg:col-span-*` lookup table for the 3-column lg grid.
 */
const LG_COL_SPAN: Record<1 | 2 | 3, string> = {
    1: 'lg:col-span-1',
    2: 'lg:col-span-2',
    3: 'lg:col-span-3'
};

/**
 * Tailwind row-span lookup table applied at both `md` and `lg`. Mobile is
 * always implicit `row-span-1` (no class needed) so cards stay single-cell.
 */
const MD_LG_ROW_SPAN: Record<1 | 2, string> = {
    1: '',
    2: 'md:row-span-2 lg:row-span-2'
};

/**
 * Computes the Tailwind class string for a given widget {@link GridSpan}.
 *
 * Mobile classes are intentionally omitted — the parent grid (`grid-cols-1`)
 * forces a 1-column flow there so spans cannot apply.
 *
 * @param span - Optional grid span pulled from the widget config.
 * @returns Space-separated Tailwind classes. Empty string when `span` is omitted
 *          or fully default (1×1).
 *
 * @example
 * ```ts
 * gridSpanClasses({ cols: 3 });
 * // → 'md:col-span-2 lg:col-span-3'
 *
 * gridSpanClasses({ cols: 2, rows: 2 });
 * // → 'md:col-span-2 lg:col-span-2 md:row-span-2 lg:row-span-2'
 *
 * gridSpanClasses();
 * // → ''
 * ```
 */
export function gridSpanClasses(span?: GridSpan): string {
    if (!span) return '';
    const cols = span.cols ?? 1;
    const rows = span.rows ?? 1;
    const parts: string[] = [];
    if (cols !== 1) {
        parts.push(MD_COL_SPAN[cols]);
        parts.push(LG_COL_SPAN[cols]);
    }
    if (rows !== 1) {
        parts.push(MD_LG_ROW_SPAN[rows]);
    }
    return parts.join(' ');
}

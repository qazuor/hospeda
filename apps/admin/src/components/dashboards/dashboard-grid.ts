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
 *   `'half'` also degrades to `md:col-span-1` so two halves still tile cleanly.
 *   Row spans (1 / 2) are preserved.
 * - **lg** (`grid-cols-6`): six-column grid so we can express thirds (cols=1, 2,
 *   3 → 2/6, 4/6, 6/6) AND halves (`'half'` → 3/6) without breaking any
 *   existing layout. The 6-col base preserves the previous "thirds" semantics
 *   that pre-existing configs already rely on.
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

type ColsValue = 1 | 2 | 3 | 'half';

/**
 * Tailwind `md:col-span-*` lookup table.
 *
 * The md grid has 2 columns; a configured `cols: 3` degrades to `md:col-span-2`.
 * `'half'` degrades to a single column so two halves stack as 1+1 = 2.
 */
const MD_COL_SPAN: Record<ColsValue, string> = {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-2',
    half: 'md:col-span-1'
};

/**
 * Tailwind `lg:col-span-*` lookup table for the 6-column lg grid.
 *
 * Existing `cols: 1 | 2 | 3` map to thirds (2/6, 4/6, 6/6) so all configs
 * shipped before the 6-col migration keep the layout they had. The new
 * `'half'` value maps to 3/6 so two siblings tile as 50/50 within a row.
 */
const LG_COL_SPAN: Record<ColsValue, string> = {
    1: 'lg:col-span-2',
    2: 'lg:col-span-4',
    3: 'lg:col-span-6',
    half: 'lg:col-span-3'
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
 * // → 'md:col-span-2 lg:col-span-6'
 *
 * gridSpanClasses({ cols: 'half' });
 * // → 'md:col-span-1 lg:col-span-3'
 *
 * gridSpanClasses({ cols: 2, rows: 2 });
 * // → 'md:col-span-2 lg:col-span-4 md:row-span-2 lg:row-span-2'
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

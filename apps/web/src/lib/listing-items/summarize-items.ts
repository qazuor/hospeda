/**
 * @file summarize-items.ts
 * @description Owner rule for summarised lists (HOS-2528, decision 2026-11-23): a list
 * collapses behind «Ver las N» only when at least {@link DEFAULT_MIN_HIDDEN} items would
 * be hidden. When 1 to 4 items would be left out, they all show and no button renders.
 * The mobile and desktop decisions are independent because the visible counts differ.
 */

/** Items that must be hidden before a list is worth collapsing. */
export const DEFAULT_MIN_HIDDEN = 5;

/** Input of {@link summarizeItems}. */
export interface SummarizeItemsInput {
    /** Total number of items in the list. */
    readonly total: number;
    /** Items shown on mobile when the list is collapsed. */
    readonly visibleMobile: number;
    /** Items shown on desktop when the list is collapsed. */
    readonly visibleDesktop: number;
    /** Minimum number of hidden items that justifies collapsing. Defaults to 5. */
    readonly minHidden?: number;
}

/** Output of {@link summarizeItems}. */
export interface SummarizeItemsResult {
    /** True when mobile shows every item and renders no «Ver las N» button. */
    readonly showAllMobile: boolean;
    /** True when desktop shows every item and renders no «Ver las N» button. */
    readonly showAllDesktop: boolean;
}

/**
 * Decides, per breakpoint, whether the whole list shows instead of a summary.
 *
 * @param input - Total, per-breakpoint visible counts and the hidden-items threshold
 * @returns Whether mobile and desktop show everything
 */
export function summarizeItems({
    total,
    visibleMobile,
    visibleDesktop,
    minHidden = DEFAULT_MIN_HIDDEN
}: SummarizeItemsInput): SummarizeItemsResult {
    return {
        showAllMobile: total - visibleMobile < minHidden,
        showAllDesktop: total - visibleDesktop < minHidden
    };
}

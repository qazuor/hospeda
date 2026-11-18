/**
 * @file fit-page-to-budget.ts
 * @description Fits one page of a host-trade list tool inside the response
 * budget (HOS-2332, spec HOS-2335 §5.3), and never returns it over.
 *
 * Two moves, in order:
 *
 * 1. **Shorter excerpts.** The page is built at each excerpt step, longest
 *    first, and the first one that fits is returned.
 * 2. **Fewer items.** The shortest step is the floor, and it is MEASURED too:
 *    text made of characters JSON escapes (`"`, control characters) can be six
 *    times longer serialized than it reads. If the floor still overflows,
 *    trailing items are dropped until it fits. The result then says
 *    `hasMore: true` and how many were left out (`omittedItems`), because the
 *    next page starts after the full page, not after what was returned: the
 *    caller asks again with a smaller `pageSize` to see them.
 */

import { MCP_RESULT_MAX_CHARS, measureResultChars } from '../response-budget';

/** What a page carries for the fit to cut it. */
export interface BudgetedPage<TItem> {
    readonly items: readonly TItem[];
    readonly hasMore: boolean;
    /** Items of this page left out to fit the budget; absent when none were. */
    readonly omittedItems?: number;
}

/**
 * Returns the page built at the longest excerpt step that fits, or the floor
 * with trailing items dropped until it fits.
 *
 * @param args.steps - Excerpt lengths, longest first; the last one is the floor
 * @param args.build - Builds the full page at one excerpt length
 * @param args.maxChars - The budget; defaults to {@link MCP_RESULT_MAX_CHARS}
 * @returns A page whose serialized length is within the budget
 */
export function fitPageToBudget<TItem, TPage extends BudgetedPage<TItem>>({
    steps,
    build,
    maxChars = MCP_RESULT_MAX_CHARS
}: {
    readonly steps: readonly number[];
    readonly build: (excerptChars: number) => TPage;
    readonly maxChars?: number;
}): TPage {
    const fits = (page: TPage) => measureResultChars({ value: page }) <= maxChars;

    for (const excerptChars of steps.slice(0, -1)) {
        const page = build(excerptChars);
        if (fits(page)) {
            return page;
        }
    }

    const floor = build(steps[steps.length - 1] ?? 0);
    if (fits(floor)) {
        return floor;
    }
    for (let kept = floor.items.length - 1; kept >= 0; kept -= 1) {
        const cut: TPage = {
            ...floor,
            items: floor.items.slice(0, kept),
            hasMore: true,
            omittedItems: floor.items.length - kept
        };
        if (fits(cut) || kept === 0) {
            return cut;
        }
    }
    return floor;
}

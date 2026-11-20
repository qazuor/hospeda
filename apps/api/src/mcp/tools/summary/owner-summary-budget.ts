/**
 * @file owner-summary-budget.ts
 * @description Keeps `get_owner_summary` inside the response budget (HOS-2335
 * §5.3, AC-C32). The result is measured the way it travels (serialized JSON).
 * Listing counts and metrics are fixed-size. Two blocks can grow:
 *
 * 1. the `subscription` block (HOS-2328): its `includes` give way first, one
 *    vertical at a time from the last, each replaced by
 *    {@link SUMMARY_INCLUDES_OMITTED}, so a plan's feature list never crowds
 *    out a notice the owner must act on (`get_my_plan` still has them);
 * 2. the attention block (owner text, listing names): items are dropped from
 *    the least urgent end and counted in `more`.
 *
 * A summary that would still be over budget with neither left is never returned.
 */

import { MCP_RESULT_MAX_CHARS, measureResultChars } from '../response-budget';
import type { OwnerSummary, SummaryIncludesOmitted } from './owner-summary-types';

/** The marker that replaces a plan's `includes` when the summary is over budget. */
export const SUMMARY_INCLUDES_OMITTED: SummaryIncludesOmitted = Object.freeze({
    omitted: 'over_budget',
    hint: 'Call get_my_plan with this vertical for what the plan includes.'
});

/** The summary with the includes of its last still-whole plan trimmed, or `undefined` when none is left. */
function trimOneIncludes(summary: OwnerSummary): OwnerSummary | undefined {
    const entries = Object.entries(summary.subscription ?? {});
    for (let index = entries.length - 1; index >= 0; index--) {
        const [vertical, item] = entries[index] ?? [];
        if (!vertical || !item || item.includes === SUMMARY_INCLUDES_OMITTED) continue;
        return {
            ...summary,
            subscription: {
                ...summary.subscription,
                [vertical]: { ...item, includes: SUMMARY_INCLUDES_OMITTED }
            }
        };
    }
    return undefined;
}

/**
 * Fits a summary to the response budget.
 *
 * @param args - The summary and the limit (defaults to {@link MCP_RESULT_MAX_CHARS})
 * @returns The summary within the limit, or `undefined` when even its
 *   attention-free form is over it
 */
export function fitSummaryToBudget({
    summary,
    maxChars = MCP_RESULT_MAX_CHARS
}: {
    readonly summary: OwnerSummary;
    readonly maxChars?: number;
}): OwnerSummary | undefined {
    let fitted = summary;
    while (measureResultChars({ value: fitted }) > maxChars) {
        const trimmed = trimOneIncludes(fitted);
        if (trimmed) {
            fitted = trimmed;
            continue;
        }
        if (fitted.attention.length === 0) {
            return undefined;
        }
        fitted = {
            ...fitted,
            attention: fitted.attention.slice(0, -1),
            more: fitted.more + 1
        };
    }
    return fitted;
}

/**
 * @file owner-summary-budget.ts
 * @description Keeps `get_owner_summary` inside the response budget (HOS-2335
 * §5.3, AC-C32). The result is measured the way it travels (serialized JSON).
 * Listing counts and metrics are fixed-size; only the attention block carries
 * owner text (listing names), so it is what gives way: items are dropped from
 * the least urgent end and counted in `more`. A summary that would
 * still be over budget with no attention left is never returned.
 */

import { MCP_RESULT_MAX_CHARS, measureResultChars } from '../response-budget';
import type { OwnerSummary } from './owner-summary-types';

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

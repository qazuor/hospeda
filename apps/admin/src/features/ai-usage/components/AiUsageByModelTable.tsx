/**
 * AiUsageByModelTable — Per-model usage breakdown table (SPEC-260 T-015).
 *
 * Renders a native `<table>` (no Shadcn table.tsx) inside a Card, displaying
 * each AI model's aggregate usage for the selected time window and filters.
 *
 * Columns:
 *   - Model (identifier string, e.g. `gpt-4o-mini`)
 *   - Calls (integer, formatted with locale separators)
 *   - Tokens In (integer)
 *   - Tokens Out (integer)
 *   - Est. Cost (formatted µUSD → USD)
 *   - Cost / 1k tokens (derived: costMicroUsd / totalTokens * 1000; `—` when 0)
 *
 * Rows are ordered by cost DESC (the API returns them this way).
 *
 * @module features/ai-usage/components/AiUsageByModelTable
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiUsageByModelQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { LoaderIcon } from '@repo/icons';
import { formatMicroUsd } from '@repo/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for {@link AiUsageByModelTable}.
 */
export interface AiUsageByModelTableProps {
    /** Current resolved search params from `Route.useSearch()`. */
    readonly search: AiUsageDailySearch;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the cost per 1k tokens (µUSD / ((tokensIn + tokensOut) / 1000)).
 * Returns `null` when total tokens is zero to avoid division-by-zero.
 *
 * @param costMicroUsd - Total cost in integer µUSD.
 * @param tokensIn - Total prompt tokens.
 * @param tokensOut - Total completion tokens.
 * @returns Cost per 1k tokens in µUSD, or `null`.
 */
function costPer1kTokens(costMicroUsd: number, tokensIn: number, tokensOut: number): number | null {
    const totalTokens = tokensIn + tokensOut;
    if (totalTokens === 0) {
        return null;
    }
    return (costMicroUsd / totalTokens) * 1000;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Per-model usage breakdown table.
 *
 * Handles loading (spinner), error (message), and empty (hint) states.
 * Rows are ordered by estimated cost DESC as returned by the API.
 *
 * @param props - {@link AiUsageByModelTableProps}
 */
export function AiUsageByModelTable({ search }: AiUsageByModelTableProps) {
    const { data, isLoading, isError } = useAiUsageByModelQuery(search);

    const description = isLoading
        ? 'Loading...'
        : isError
          ? 'Failed to load data'
          : data && data.items.length > 0
            ? `${data.items.length.toLocaleString()} model${data.items.length === 1 ? '' : 's'} — ordered by cost`
            : 'No data for the selected window';

    return (
        <Card>
            <CardHeader>
                <CardTitle>By Model</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-10 text-center">
                        <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                        <p className="mt-3 text-muted-foreground text-sm">Loading model data…</p>
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center">
                        <p className="text-destructive text-sm">Failed to load model usage.</p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            Verify the API is reachable and try again.
                        </p>
                    </div>
                ) : !data || data.items.length === 0 ? (
                    <div className="py-10 text-center">
                        <p className="text-muted-foreground text-sm">
                            No model usage for the selected filters.
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            Adjust the time window or remove filters to see data.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">Model</th>
                                    <th className="px-4 py-3 text-right font-medium">Calls</th>
                                    <th className="px-4 py-3 text-right font-medium">Tokens In</th>
                                    <th className="px-4 py-3 text-right font-medium">Tokens Out</th>
                                    <th className="px-4 py-3 text-right font-medium">Est. Cost</th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Cost / 1k tokens
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((row) => {
                                    const perK = costPer1kTokens(
                                        row.costMicroUsd,
                                        row.tokensIn,
                                        row.tokensOut
                                    );
                                    return (
                                        <tr
                                            key={row.model}
                                            className="border-b hover:bg-muted/50"
                                        >
                                            <td className="px-4 py-3 font-mono text-xs">
                                                {row.model}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {row.calls.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {row.tokensIn.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {row.tokensOut.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium tabular-nums">
                                                {formatMicroUsd(row.costMicroUsd)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                                                {perK !== null ? formatMicroUsd(perK) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

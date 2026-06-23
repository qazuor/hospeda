/**
 * AiUsageByFeatureModelTable — Feature × model cross breakdown table (SPEC-260 T-016).
 *
 * Renders a native `<table>` inside a Card, displaying one row per
 * (feature, model) pair for the selected time window and filters.
 *
 * Columns:
 *   - Feature (identifier string, e.g. `text_improve`)
 *   - Model (identifier string, e.g. `gpt-4o-mini`)
 *   - Calls (integer, locale-formatted)
 *   - Tokens In (integer)
 *   - Tokens Out (integer)
 *   - Est. Cost (formatted µUSD → USD)
 *
 * Rows are ordered by cost DESC (the API returns them this way).
 * Uses `pageSize: 100` so the TanStack Query cache entry is shared with
 * `AiUsageByFeatureTable` (T-015) — zero extra network requests.
 *
 * @module features/ai-usage/components/AiUsageByFeatureModelTable
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiUsageByFeatureModelQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { LoaderIcon } from '@repo/icons';
import { formatMicroUsd } from '@repo/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for {@link AiUsageByFeatureModelTable}.
 */
export interface AiUsageByFeatureModelTableProps {
    /** Current resolved search params from `Route.useSearch()`. */
    readonly search: AiUsageDailySearch;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Feature × model cross breakdown table.
 *
 * One row per (feature, model) pair. Handles loading (spinner), error
 * (message), and empty (hint) states.
 *
 * @param props - {@link AiUsageByFeatureModelTableProps}
 */
export function AiUsageByFeatureModelTable({ search }: AiUsageByFeatureModelTableProps) {
    // pageSize: 100 matches AiUsageByFeatureTable → shared TanStack Query cache entry.
    const { data, isLoading, isError } = useAiUsageByFeatureModelQuery({
        year: search.year,
        month: search.month,
        since: search.since,
        until: search.until,
        userId: search.userId,
        page: 1,
        pageSize: 100
    });

    const description = isLoading
        ? 'Loading...'
        : isError
          ? 'Failed to load data'
          : data && data.items.length > 0
            ? `${data.items.length.toLocaleString()} pair${data.items.length === 1 ? '' : 's'} — ordered by cost`
            : 'No data for the selected window';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Feature × Model</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-10 text-center">
                        <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                        <p className="mt-3 text-muted-foreground text-sm">
                            Loading feature × model data…
                        </p>
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center">
                        <p className="text-destructive text-sm">
                            Failed to load feature × model usage.
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            Verify the API is reachable and try again.
                        </p>
                    </div>
                ) : !data || data.items.length === 0 ? (
                    <div className="py-10 text-center">
                        <p className="text-muted-foreground text-sm">
                            No feature × model usage for the selected filters.
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
                                    <th className="px-4 py-3 text-left font-medium">Feature</th>
                                    <th className="px-4 py-3 text-left font-medium">Model</th>
                                    <th className="px-4 py-3 text-right font-medium">Calls</th>
                                    <th className="px-4 py-3 text-right font-medium">Tokens In</th>
                                    <th className="px-4 py-3 text-right font-medium">Tokens Out</th>
                                    <th className="px-4 py-3 text-right font-medium">Est. Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((row) => (
                                    <tr
                                        key={`${row.feature}:${row.model}`}
                                        className="border-b hover:bg-muted/50"
                                    >
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {row.feature}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

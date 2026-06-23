/**
 * AiUsageTotalsCard — Aggregated totals summary for the AI usage dashboard (SPEC-260 T-015).
 *
 * Sums all rows from the by-model endpoint (which covers every AI call
 * regardless of feature grouping) to produce four headline numbers:
 *   - Total API calls
 *   - Total prompt tokens (in)
 *   - Total completion tokens (out)
 *   - Total estimated cost (µUSD → formatted USD)
 *
 * The by-model data is the canonical aggregate source for totals because:
 *   1. Every call has exactly one model → no double-counting.
 *   2. The hook is already needed by T-015's by-model table → zero extra requests.
 *   3. A dedicated `/totals` endpoint does not exist in SPEC-260.
 *
 * @module features/ai-usage/components/AiUsageTotalsCard
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiUsageByModelQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { useTranslations } from '@/hooks/use-translations';
import type { AiUsageByModelRow } from '@repo/schemas';
import { formatMicroUsd } from '@repo/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for {@link AiUsageTotalsCard}.
 */
export interface AiUsageTotalsCardProps {
    /** Current resolved search params from `Route.useSearch()`. */
    readonly search: AiUsageDailySearch;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Aggregate totals shape derived from by-model rows.
 */
interface Totals {
    readonly calls: number;
    readonly tokensIn: number;
    readonly tokensOut: number;
    readonly costMicroUsd: number;
}

/**
 * Reduces an array of by-model rows into a single aggregate totals object.
 *
 * @param rows - The items array from the by-model paginated response.
 * @returns Summed totals across all rows.
 */
function sumByModelRows(rows: readonly AiUsageByModelRow[]): Totals {
    return rows.reduce<Totals>(
        (acc, row) => ({
            calls: acc.calls + row.calls,
            tokensIn: acc.tokensIn + row.tokensIn,
            tokensOut: acc.tokensOut + row.tokensOut,
            costMicroUsd: acc.costMicroUsd + row.costMicroUsd
        }),
        { calls: 0, tokensIn: 0, tokensOut: 0, costMicroUsd: 0 }
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * A single metric card in the totals row.
 */
interface MetricCardProps {
    readonly label: string;
    readonly value: string;
    readonly sublabel?: string;
}

function MetricCard({ label, value, sublabel }: MetricCardProps) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="font-medium text-muted-foreground text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="font-bold text-2xl tabular-nums">{value}</p>
                {sublabel && <p className="mt-0.5 text-muted-foreground text-xs">{sublabel}</p>}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Skeleton keys (stable array avoids Biome noArrayIndexKey)
// ---------------------------------------------------------------------------

const SKELETON_KEYS = ['calls', 'tokens-in', 'tokens-out', 'cost'] as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders four headline metric cards (calls, tokens in, tokens out, cost).
 *
 * Aggregates all pages of the by-model query. Note: when the result set is
 * paginated the displayed totals reflect the loaded page only — this is
 * intentional for the MVP and matches the filter context visible on screen.
 *
 * @param props - {@link AiUsageTotalsCardProps}
 */
export function AiUsageTotalsCard({ search }: AiUsageTotalsCardProps) {
    const { t } = useTranslations();

    // Re-use the by-model hook with a large pageSize to capture as many rows as
    // possible without a dedicated /totals endpoint. The hook is shared with the
    // by-model table below (TanStack Query caches by identical key).
    const { data, isLoading, isError } = useAiUsageByModelQuery({
        ...search,
        pageSize: 100
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {SKELETON_KEYS.map((key) => (
                    <Card key={key}>
                        <CardHeader className="pb-2">
                            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (isError || !data) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <p className="text-destructive text-sm">
                        {t('admin-pages.ai.usage.totals.loadError')}
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs">
                        {t('admin-pages.ai.usage.totals.loadErrorHint')}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const totals = sumByModelRows(data.items);
    const totalTokens = totals.tokensIn + totals.tokensOut;

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
                label={t('admin-pages.ai.usage.totals.title')}
                value={totals.calls.toLocaleString()}
                sublabel={t('admin-pages.ai.usage.totals.subtitle')}
            />
            <MetricCard
                label={t('admin-pages.ai.usage.totals.tokensIn')}
                value={totals.tokensIn.toLocaleString()}
                sublabel={t('admin-pages.ai.usage.totals.subtitleTokensIn')}
            />
            <MetricCard
                label={t('admin-pages.ai.usage.totals.tokensOut')}
                value={totals.tokensOut.toLocaleString()}
                sublabel={t('admin-pages.ai.usage.totals.subtitleTokensOut')}
            />
            <MetricCard
                label={t('admin-pages.ai.usage.totals.estCost')}
                value={formatMicroUsd(totals.costMicroUsd)}
                sublabel={t('admin-pages.ai.usage.totals.subtitleCost', {
                    total: totalTokens.toLocaleString()
                })}
            />
        </div>
    );
}

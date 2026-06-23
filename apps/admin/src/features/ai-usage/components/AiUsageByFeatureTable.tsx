/**
 * AiUsageByFeatureTable — Per-feature usage breakdown table (SPEC-260 T-015).
 *
 * There is no dedicated `/by-feature` endpoint in SPEC-260. This component
 * derives the per-feature breakdown by client-side grouping of the
 * `/by-feature-model` response: rows sharing the same `feature` value are
 * aggregated (calls + tokensIn + tokensOut + costMicroUsd summed), and the
 * result is sorted by cost DESC.
 *
 * This approach is acceptable for the MVP because:
 *   - The by-feature-model hook is already fetched for T-016's feature×model
 *     table, so this triggers no extra network requests (TanStack Query cache hit).
 *   - Feature cardinality is bounded (7 features as of SPEC-260), so grouping
 *     client-side is O(n) with trivially small n.
 *
 * Columns:
 *   - Feature (identifier string, e.g. `text_improve`)
 *   - Calls (integer, locale-formatted)
 *   - Tokens In (integer)
 *   - Tokens Out (integer)
 *   - Est. Cost (formatted µUSD → USD)
 *
 * Rows are sorted by cost DESC (derived from the grouped data).
 *
 * @module features/ai-usage/components/AiUsageByFeatureTable
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AiUsageBlockState } from '@/features/ai-usage/components/AiUsageBlockState';
import { useAiUsageByFeatureModelQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { useTranslations } from '@/hooks/use-translations';
import type { AiUsageByFeatureModelRow } from '@repo/schemas';
import { formatMicroUsd } from '@repo/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for {@link AiUsageByFeatureTable}.
 */
export interface AiUsageByFeatureTableProps {
    /** Current resolved search params from `Route.useSearch()`. */
    readonly search: AiUsageDailySearch;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Per-feature aggregate derived from feature×model rows.
 */
interface FeatureAggregate {
    readonly feature: string;
    readonly calls: number;
    readonly tokensIn: number;
    readonly tokensOut: number;
    readonly costMicroUsd: number;
}

/**
 * Groups feature×model rows by `feature`, summing all metrics per feature.
 * The result is sorted by `costMicroUsd` DESC.
 *
 * @param rows - Items from the by-feature-model paginated response.
 * @returns Array of per-feature aggregates ordered by cost DESC.
 */
function groupByFeature(rows: readonly AiUsageByFeatureModelRow[]): readonly FeatureAggregate[] {
    const map = new Map<string, FeatureAggregate>();

    for (const row of rows) {
        const existing = map.get(row.feature);
        if (existing) {
            map.set(row.feature, {
                feature: row.feature,
                calls: existing.calls + row.calls,
                tokensIn: existing.tokensIn + row.tokensIn,
                tokensOut: existing.tokensOut + row.tokensOut,
                costMicroUsd: existing.costMicroUsd + row.costMicroUsd
            });
        } else {
            map.set(row.feature, {
                feature: row.feature,
                calls: row.calls,
                tokensIn: row.tokensIn,
                tokensOut: row.tokensOut,
                costMicroUsd: row.costMicroUsd
            });
        }
    }

    return [...map.values()].sort((a, b) => b.costMicroUsd - a.costMicroUsd);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Per-feature usage breakdown table, derived by grouping by-feature-model rows.
 *
 * Handles loading (spinner), error (message), and empty (hint) states.
 *
 * @param props - {@link AiUsageByFeatureTableProps}
 */
export function AiUsageByFeatureTable({ search }: AiUsageByFeatureTableProps) {
    const { t, tPlural } = useTranslations();

    // Re-use by-feature-model with a large pageSize to capture all cross rows.
    // TanStack Query caches by queryKey — T-016's table will use the same cache entry.
    const { data, isLoading, isError } = useAiUsageByFeatureModelQuery({
        year: search.year,
        month: search.month,
        since: search.since,
        until: search.until,
        userId: search.userId,
        page: 1,
        pageSize: 100
    });

    const rows = data ? groupByFeature(data.items) : [];

    const description = isLoading
        ? t('admin-pages.ai.usage.byFeature.loading')
        : isError
          ? t('admin-pages.ai.usage.byFeature.loadError')
          : rows.length > 0
            ? tPlural('admin-pages.ai.usage.byFeature.desc', rows.length)
            : t('admin-pages.ai.usage.byFeature.empty');

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-pages.ai.usage.byFeature.title')}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <AiUsageBlockState
                        status="loading"
                        title={t('admin-pages.ai.usage.byFeature.loading')}
                    />
                ) : isError ? (
                    <AiUsageBlockState
                        status="error"
                        title={t('admin-pages.ai.usage.byFeature.loadError')}
                        hint={t('admin-pages.ai.usage.byFeature.loadErrorHint')}
                    />
                ) : rows.length === 0 ? (
                    <AiUsageBlockState
                        status="empty"
                        title={t('admin-pages.ai.usage.byFeature.empty')}
                        hint={t('admin-pages.ai.usage.byFeature.emptyHint')}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <caption className="sr-only">
                                {t('admin-pages.ai.usage.a11y.tableByFeature')}
                            </caption>
                            <thead>
                                <tr className="border-b">
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-left font-medium"
                                    >
                                        {t('admin-pages.ai.usage.table.colFeature')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right font-medium"
                                    >
                                        {t('admin-pages.ai.usage.table.colCalls')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right font-medium"
                                    >
                                        {t('admin-pages.ai.usage.table.colTokensIn')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right font-medium"
                                    >
                                        {t('admin-pages.ai.usage.table.colTokensOut')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right font-medium"
                                    >
                                        {t('admin-pages.ai.usage.table.colEstCost')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr
                                        key={row.feature}
                                        className="border-b hover:bg-muted/50"
                                    >
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {row.feature}
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

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
import { AiUsageBlockState } from '@/features/ai-usage/components/AiUsageBlockState';
import { useAiUsageByModelQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { useTranslations } from '@/hooks/use-translations';
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
 * Delegates loading/error/empty states to {@link AiUsageBlockState} for
 * consistent visual treatment across all AI usage dashboard blocks.
 * Rows are ordered by estimated cost DESC as returned by the API.
 *
 * @param props - {@link AiUsageByModelTableProps}
 */
export function AiUsageByModelTable({ search }: AiUsageByModelTableProps) {
    const { t, tPlural } = useTranslations();
    const { data, isLoading, isError } = useAiUsageByModelQuery(search);

    const description = isLoading
        ? t('admin-pages.ai.usage.byModel.loading')
        : isError
          ? t('admin-pages.ai.usage.byModel.loadError')
          : data && data.items.length > 0
            ? tPlural('admin-pages.ai.usage.byModel.desc', data.items.length)
            : t('admin-pages.ai.usage.byModel.empty');

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-pages.ai.usage.byModel.title')}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <AiUsageBlockState
                        status="loading"
                        title={t('admin-pages.ai.usage.byModel.loading')}
                    />
                ) : isError ? (
                    <AiUsageBlockState
                        status="error"
                        title={t('admin-pages.ai.usage.byModel.loadError')}
                        hint={t('admin-pages.ai.usage.byModel.loadErrorHint')}
                    />
                ) : !data || data.items.length === 0 ? (
                    <AiUsageBlockState
                        status="empty"
                        title={t('admin-pages.ai.usage.byModel.empty')}
                        hint={t('admin-pages.ai.usage.byModel.emptyHint')}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-pages.ai.usage.table.colModel')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-pages.ai.usage.table.colCalls')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-pages.ai.usage.table.colTokensIn')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-pages.ai.usage.table.colTokensOut')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-pages.ai.usage.table.colEstCost')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-pages.ai.usage.table.colCostPer1k')}
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

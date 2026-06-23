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
import { useTranslations } from '@/hooks/use-translations';
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
    const { t, tPlural } = useTranslations();

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
        ? t('admin-pages.ai.usage.featureModel.loading')
        : isError
          ? t('admin-pages.ai.usage.featureModel.loadError')
          : data && data.items.length > 0
            ? tPlural('admin-pages.ai.usage.featureModel.desc', data.items.length)
            : t('admin-pages.ai.usage.featureModel.empty');

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-pages.ai.usage.featureModel.tableTitle')}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-10 text-center">
                        <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                        <p className="mt-3 text-muted-foreground text-sm">
                            {t('admin-pages.ai.usage.featureModel.loading')}
                        </p>
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center">
                        <p className="text-destructive text-sm">
                            {t('admin-pages.ai.usage.featureModel.loadError')}
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            {t('admin-pages.ai.usage.featureModel.loadErrorHint')}
                        </p>
                    </div>
                ) : !data || data.items.length === 0 ? (
                    <div className="py-10 text-center">
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.ai.usage.featureModel.empty')}
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            {t('admin-pages.ai.usage.featureModel.emptyHint')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-pages.ai.usage.table.colFeature')}
                                    </th>
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

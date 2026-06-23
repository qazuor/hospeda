/**
 * AiUsageByProviderTable — Per-provider usage breakdown table (SPEC-260 T-015).
 *
 * Renders a native `<table>` inside a Card, displaying each AI provider's
 * aggregate usage for the selected time window and filters.
 *
 * Columns:
 *   - Provider (e.g. `openai`, `anthropic`, `stub`)
 *   - Calls (integer, locale-formatted)
 *   - Tokens In (integer)
 *   - Tokens Out (integer)
 *   - Est. Cost (formatted µUSD → USD)
 *
 * Rows are ordered by cost DESC (the API returns them this way).
 *
 * @module features/ai-usage/components/AiUsageByProviderTable
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AiUsageBlockState } from '@/features/ai-usage/components/AiUsageBlockState';
import { useAiUsageByProviderQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { useTranslations } from '@/hooks/use-translations';
import { formatMicroUsd } from '@repo/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for {@link AiUsageByProviderTable}.
 */
export interface AiUsageByProviderTableProps {
    /** Current resolved search params from `Route.useSearch()`. */
    readonly search: AiUsageDailySearch;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Per-provider usage breakdown table.
 *
 * Handles loading (spinner), error (message), and empty (hint) states.
 * Rows are ordered by estimated cost DESC as returned by the API.
 *
 * @param props - {@link AiUsageByProviderTableProps}
 */
export function AiUsageByProviderTable({ search }: AiUsageByProviderTableProps) {
    const { t, tPlural } = useTranslations();
    const { data, isLoading, isError } = useAiUsageByProviderQuery(search);

    const description = isLoading
        ? t('admin-pages.ai.usage.byProvider.loading')
        : isError
          ? t('admin-pages.ai.usage.byProvider.loadError')
          : data && data.items.length > 0
            ? tPlural('admin-pages.ai.usage.byProvider.desc', data.items.length)
            : t('admin-pages.ai.usage.byProvider.empty');

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-pages.ai.usage.byProvider.title')}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <AiUsageBlockState
                        status="loading"
                        title={t('admin-pages.ai.usage.byProvider.loading')}
                    />
                ) : isError ? (
                    <AiUsageBlockState
                        status="error"
                        title={t('admin-pages.ai.usage.byProvider.loadError')}
                        hint={t('admin-pages.ai.usage.byProvider.loadErrorHint')}
                    />
                ) : !data || data.items.length === 0 ? (
                    <AiUsageBlockState
                        status="empty"
                        title={t('admin-pages.ai.usage.byProvider.empty')}
                        hint={t('admin-pages.ai.usage.byProvider.emptyHint')}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-pages.ai.usage.table.colProvider')}
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
                                        key={row.provider}
                                        className="border-b hover:bg-muted/50"
                                    >
                                        <td className="px-4 py-3 font-medium capitalize">
                                            {row.provider}
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

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
import { useAiUsageByProviderQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { useTranslations } from '@/hooks/use-translations';
import { LoaderIcon } from '@repo/icons';
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
                    <div className="py-10 text-center">
                        <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                        <p className="mt-3 text-muted-foreground text-sm">
                            {t('admin-pages.ai.usage.byProvider.loading')}
                        </p>
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center">
                        <p className="text-destructive text-sm">
                            {t('admin-pages.ai.usage.byProvider.loadError')}
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            {t('admin-pages.ai.usage.byProvider.loadErrorHint')}
                        </p>
                    </div>
                ) : !data || data.items.length === 0 ? (
                    <div className="py-10 text-center">
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.ai.usage.byProvider.empty')}
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            {t('admin-pages.ai.usage.byProvider.emptyHint')}
                        </p>
                    </div>
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

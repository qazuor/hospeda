import { LoaderIcon } from '@repo/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { OrphanQueueItem } from './types';
import { formatArsFromCents, formatDate, getQueueFlowLabel, getQueueReasonLabel } from './utils';

/**
 * Props for {@link OrphanQueueTable}.
 */
export interface OrphanQueueTableProps {
    readonly items: OrphanQueueItem[];
    readonly isLoading: boolean;
    readonly isError: boolean;
    /**
     * Rows still awaiting a human across the WHOLE table, ignoring the active
     * filter. Shown as the header count so narrowing the view cannot make an
     * open incident look resolved.
     */
    readonly unresolvedTotal: number;
    readonly onResolve: (item: OrphanQueueItem) => void;
}

/**
 * Orphan-payment queue table (HOS-1001).
 *
 * The reader half of `billing_orphan_payments`. Until this existed the table
 * was write-only: four confirmation flows could record a charge the platform
 * took and could not book, and nothing could show it to anybody.
 *
 * Two rendering decisions are load-bearing rather than cosmetic:
 *
 * - **`livemode` is a column, not a detail.** The first thing a triage decision
 *   needs is whether real money moved; a sandbox test and a genuine stranded
 *   charge are otherwise the same row.
 * - **The header count is `unresolvedTotal`, not `items.length`.** The list is
 *   filtered and paged; the incident count must not be.
 */
export function OrphanQueueTable({
    items,
    isLoading,
    isError,
    unresolvedTotal,
    onResolve
}: OrphanQueueTableProps) {
    const { t, tPlural, locale } = useTranslations();

    const cardDescription = isLoading
        ? t('admin-billing.reconciliation.queue.loading')
        : isError
          ? t('admin-billing.reconciliation.queue.errorLoading')
          : tPlural('admin-billing.reconciliation.queue.unresolvedCount', unresolvedTotal);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-billing.reconciliation.queue.title')}</CardTitle>
                <CardDescription>{cardDescription}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-12 text-center">
                        <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground text-sm">
                            {t('admin-billing.reconciliation.queue.loading')}
                        </p>
                    </div>
                ) : isError ? (
                    <div className="py-12 text-center">
                        <p className="text-destructive text-sm">
                            {t('admin-billing.reconciliation.queue.errorLoading')}
                        </p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-muted-foreground text-sm">
                            {t('admin-billing.reconciliation.queue.emptyTitle')}
                        </p>
                        <p className="mt-2 text-muted-foreground text-xs">
                            {t('admin-billing.reconciliation.queue.emptyHint')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.reconciliation.queue.columns.detectedAt')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t(
                                            'admin-billing.reconciliation.queue.columns.providerPaymentId'
                                        )}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.reconciliation.queue.columns.flow')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.reconciliation.queue.columns.reason')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-billing.reconciliation.queue.columns.amount')}
                                    </th>
                                    <th className="px-4 py-3 text-center font-medium">
                                        {t('admin-billing.reconciliation.queue.columns.livemode')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t(
                                            'admin-billing.reconciliation.queue.columns.subscriptionId'
                                        )}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-billing.reconciliation.queue.columns.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-b hover:bg-muted/50"
                                    >
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {formatDate(item.detectedAt, locale)}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {item.providerPaymentId}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline">
                                                {getQueueFlowLabel(item.flow, t)}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                variant={
                                                    item.reason === 'ledger-write-failed'
                                                        ? 'destructive'
                                                        : 'default'
                                                }
                                            >
                                                {getQueueReasonLabel(item.reason, t)}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {formatArsFromCents(item.amountInCents, locale)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                variant={item.livemode ? 'destructive' : 'outline'}
                                            >
                                                {item.livemode
                                                    ? t(
                                                          'admin-billing.reconciliation.queue.livemodeReal'
                                                      )
                                                    : t(
                                                          'admin-billing.reconciliation.queue.livemodeSandbox'
                                                      )}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {item.subscriptionId ?? (
                                                <span className="text-muted-foreground italic">
                                                    {t('admin-billing.common.noData')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {item.status === 'unresolved' ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onResolve(item)}
                                                >
                                                    {t(
                                                        'admin-billing.reconciliation.queue.resolveButton'
                                                    )}
                                                </Button>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">
                                                    {item.resolutionNote ??
                                                        t('admin-billing.common.noData')}
                                                </span>
                                            )}
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

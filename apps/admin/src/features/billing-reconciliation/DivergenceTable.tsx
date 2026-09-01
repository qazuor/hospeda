import { LoaderIcon } from '@repo/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { Divergence } from './types';
import { formatArsFromCents, formatDate, getKindLabel, getMpStatusVariant } from './utils';

/**
 * Read the payer email an operator can actually trust for one divergence row.
 *
 * For an `unrecorded-payment`, `payerEmail` IS the real payer email (read off
 * the payment). For an `orphan-preapproval`, `preapproval.payer_email` comes
 * back EMPTY from MercadoPago on every real preapproval — the email worth
 * anything is `payerEmailFromPayment`, recovered from a linked payment, and
 * it is commonly `null` (a normal "not attributable yet" state, not a
 * failure). This helper is the single place that picks the right field so
 * every consumer of this table agrees on which email is "the one that
 * counts".
 */
function getTrustedPayerEmail(divergence: Divergence): string | null {
    return divergence.kind === 'unrecorded-payment'
        ? divergence.payerEmail
        : divergence.payerEmailFromPayment;
}

/** The stable identifier shown in the "identifier" column. */
function getDivergenceIdentifier(divergence: Divergence): string {
    return divergence.kind === 'unrecorded-payment'
        ? divergence.mpPaymentId
        : divergence.preapprovalId;
}

/** React list key — must be unique across BOTH kinds, so it is kind-prefixed. */
function getDivergenceKey(divergence: Divergence): string {
    return `${divergence.kind}:${getDivergenceIdentifier(divergence)}`;
}

/**
 * Props for {@link DivergenceTable}.
 */
export interface DivergenceTableProps {
    readonly divergences: Divergence[];
    readonly isLoading: boolean;
    readonly isError: boolean;
    readonly onViewDetails: (divergence: Divergence) => void;
    readonly onReconcile: (divergence: Divergence) => void;
}

/**
 * Divergence table for the orphan-payment rescue screen (HOS-765).
 *
 * Renders both {@link Divergence} kinds in one list, mirroring the endpoint
 * contract (both sides of the ledger reported together on purpose — an
 * operator triaging one wants to see the other). Never links anything
 * itself: the row's action button opens {@link ReconcileActionDialog} with
 * an EMPTY destination field, same as "Ver detalle" opens the read-only
 * evidence view.
 */
export function DivergenceTable({
    divergences,
    isLoading,
    isError,
    onViewDetails,
    onReconcile
}: DivergenceTableProps) {
    const { t, tPlural, locale } = useTranslations();

    const cardDescription = isLoading
        ? t('admin-billing.reconciliation.table.loading')
        : isError
          ? t('admin-billing.reconciliation.table.errorLoading')
          : divergences.length === 0
            ? t('admin-billing.reconciliation.table.empty')
            : tPlural('admin-billing.reconciliation.table.divergenceCount', divergences.length);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-billing.reconciliation.table.title')}</CardTitle>
                <CardDescription>{cardDescription}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-12 text-center">
                        <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground text-sm">
                            {t('admin-billing.reconciliation.table.loading')}
                        </p>
                    </div>
                ) : isError ? (
                    <div className="py-12 text-center">
                        <p className="text-destructive text-sm">
                            {t('admin-billing.reconciliation.table.errorLoading')}
                        </p>
                    </div>
                ) : divergences.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-muted-foreground text-sm">
                            {t('admin-billing.reconciliation.table.emptyTitle')}
                        </p>
                        <p className="mt-2 text-muted-foreground text-xs">
                            {t('admin-billing.reconciliation.table.emptyHint')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.reconciliation.table.columns.kind')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.reconciliation.table.columns.identifier')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.reconciliation.table.columns.payerEmail')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-billing.reconciliation.table.columns.amount')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.reconciliation.table.columns.date')}
                                    </th>
                                    <th className="px-4 py-3 text-center font-medium">
                                        {t('admin-billing.reconciliation.table.columns.mpStatus')}
                                    </th>
                                    <th className="px-4 py-3 text-center font-medium">
                                        {t('admin-billing.reconciliation.table.columns.candidates')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-billing.reconciliation.table.columns.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {divergences.map((divergence) => {
                                    const trustedEmail = getTrustedPayerEmail(divergence);
                                    return (
                                        <tr
                                            key={getDivergenceKey(divergence)}
                                            className="border-b hover:bg-muted/50"
                                        >
                                            <td className="px-4 py-3">
                                                <Badge variant="outline">
                                                    {getKindLabel(divergence.kind, t)}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">
                                                {getDivergenceIdentifier(divergence)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {trustedEmail ? (
                                                    trustedEmail
                                                ) : (
                                                    <span className="text-muted-foreground text-xs italic">
                                                        {t(
                                                            'admin-billing.reconciliation.notAttributableYet'
                                                        )}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                {formatArsFromCents(
                                                    divergence.amountInCents,
                                                    locale
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                                {formatDate(divergence.createdAt, locale)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    variant={getMpStatusVariant(
                                                        divergence.mpStatus
                                                    )}
                                                >
                                                    {divergence.mpStatus}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {divergence.candidates.length}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onViewDetails(divergence)}
                                                    >
                                                        {t(
                                                            'admin-billing.reconciliation.table.viewButton'
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onReconcile(divergence)}
                                                    >
                                                        {divergence.kind === 'unrecorded-payment'
                                                            ? t(
                                                                  'admin-billing.reconciliation.table.backfillButton'
                                                              )
                                                            : t(
                                                                  'admin-billing.reconciliation.table.forceLinkButton'
                                                              )}
                                                    </Button>
                                                </div>
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

/**
 * @file ProposedRefundsScreen.tsx
 * Lists the refunds proposed from a reconciliation mark that await action 13, with the mark that
 * originated each one.
 */

import type { TranslationKey } from '@repo/i18n';
import { formatCurrency } from '@repo/i18n';
import { PermissionEnum, type ProposedRefund } from '@repo/schemas';
import { useEffect, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import {
    RECONCILIATION_REASON_KEYS,
    reconciliationLabel
} from '../../billing-reconciliation/reconciliation-labels';
import { useProposedRefunds } from '../hooks/useProposedRefunds';
import { ProposedRefundActions } from './ProposedRefundActions';
import { RefundProviderCallRetryForm } from './RefundProviderCallRetryForm';

const PAGE_SIZE = 50;

/**
 * Formats a refund amount. A manual payment stores no currency, so its amount is shown as a plain
 * number rather than guessing one.
 *
 * @param input - The amount in minor units, its currency if known, and the locale.
 * @returns The amount for display.
 */
export function formatProposedRefundAmount({
    amountMinor,
    currency,
    locale
}: {
    readonly amountMinor: number;
    readonly currency: string | null;
    readonly locale: string;
}): string {
    return currency === null
        ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(amountMinor / 100)
        : formatCurrency({ value: amountMinor / 100, currency, locale });
}

/**
 * Proposed-refund screen, gated by the permission of the action it feeds. Below the list, «Retry with
 * MP» (HOS-2516) resends the unanswered provider calls of a confirmed refund: such a refund has a
 * live call, so it is not in the list.
 */
export function ProposedRefundsScreen() {
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_REFUND]}>
            <div className="space-y-6">
                <ProposedRefundsBody />
                <RefundProviderCallRetryForm />
            </div>
        </PermissionGate>
    );
}

function ProposedRefundsBody() {
    const { t, locale } = useTranslations();
    const [page, setPage] = useState(1);
    const query = useProposedRefunds({ page, pageSize: PAGE_SIZE });
    const data = query.data;
    // Resolving the last row of the last page leaves that page past the end: step back to the new
    // last page instead of showing an empty list while earlier pages still hold refunds.
    const lastPage = Math.max(data?.pagination.totalPages ?? 1, 1);
    const pastTheEnd = data !== undefined && page > lastPage;
    useEffect(() => {
        if (pastTheEnd) setPage(lastPage);
    }, [pastTheEnd, lastPage]);
    if (query.isLoading || pastTheEnd) return <p>{t('admin-billing.proposedRefunds.loading')}</p>;
    if (query.isError)
        return (
            <div
                role="alert"
                className="space-y-2"
            >
                <p>{t('admin-billing.proposedRefunds.error')}</p>
                <Button onClick={() => void query.refetch()}>
                    {t('admin-billing.proposedRefunds.retry')}
                </Button>
            </div>
        );
    if (!data || data.items.length === 0)
        return (
            <p data-testid="proposed-refunds-empty">{t('admin-billing.proposedRefunds.empty')}</p>
        );
    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <p className="text-muted-foreground">
                    {t('admin-billing.proposedRefunds.description')}
                </p>
                <div className="space-y-4">
                    {data.items.map((refund) => (
                        <ProposedRefundArticle
                            key={refund.refundId}
                            refund={refund}
                            locale={locale}
                            t={t}
                        />
                    ))}
                </div>
                <nav
                    aria-label={t('admin-billing.proposedRefunds.pagination')}
                    className="flex items-center justify-between"
                >
                    <span>{data.pagination.total}</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={page <= 1}
                            onClick={() => setPage((current) => current - 1)}
                        >
                            {t('admin-billing.proposedRefunds.previous')}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={page >= data.pagination.totalPages}
                            onClick={() => setPage((current) => current + 1)}
                        >
                            {t('admin-billing.proposedRefunds.next')}
                        </Button>
                    </div>
                </nav>
            </CardContent>
        </Card>
    );
}

function ProposedRefundArticle({
    refund,
    locale,
    t
}: {
    readonly refund: ProposedRefund;
    readonly locale: string;
    readonly t: (key: TranslationKey, params?: Record<string, unknown>) => string;
}) {
    const amountLabel = formatProposedRefundAmount({
        amountMinor: refund.amountMinor,
        currency: refund.currency,
        locale
    });
    return (
        <article
            data-testid="proposed-refund"
            data-refund-id={refund.refundId}
            data-status={refund.status}
            className="space-y-2 rounded-md border p-4"
        >
            <h2
                className="font-semibold"
                data-testid="proposed-refund-amount"
            >
                {t('admin-billing.proposedRefunds.amount')}: {amountLabel}
            </h2>
            <p data-testid="proposed-refund-status">
                {t('admin-billing.proposedRefunds.status')}:{' '}
                {t(
                    refund.status === 'REQUESTED'
                        ? 'admin-billing.proposedRefunds.statuses.REQUESTED'
                        : 'admin-billing.proposedRefunds.statuses.CONFIRMED'
                )}
            </p>
            <p>
                {t('admin-billing.proposedRefunds.requestedAt')}:{' '}
                {formatDateWithTime({ date: refund.requestedAt, locale })}
            </p>
            <p>
                {t('admin-billing.proposedRefunds.payment')}:{' '}
                {t(
                    `admin-billing.reconciliationMarks.sources.${refund.payment.source === 'PAYMENT' ? 'card' : 'manual'}`
                )}{' '}
                · {refund.payment.id}
            </p>
            <section aria-label={t('admin-billing.proposedRefunds.origin')}>
                <h3 className="font-medium">{t('admin-billing.proposedRefunds.origin')}</h3>
                {refund.marks.length === 0 ? (
                    <p data-testid="proposed-refund-no-mark">
                        {t('admin-billing.proposedRefunds.noMark')}
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {refund.marks.map((mark) => (
                            <li
                                key={mark.markId}
                                data-testid="proposed-refund-mark"
                                data-mark-id={mark.markId}
                                data-reason={mark.reason}
                            >
                                {mark.reasonNumber} ·{' '}
                                {reconciliationLabel({
                                    map: RECONCILIATION_REASON_KEYS,
                                    value: mark.reason,
                                    t
                                })}{' '}
                                (
                                {t(
                                    `admin-billing.reconciliationMarks.subjectKinds.${mark.subject.kind}`
                                )}
                                ,{' '}
                                {mark.liftedAt === null
                                    ? t('admin-billing.proposedRefunds.markOpen')
                                    : t('admin-billing.proposedRefunds.markLifted')}
                                ) · {formatDateWithTime({ date: mark.openedAt, locale })}
                            </li>
                        ))}
                    </ul>
                )}
                <a
                    href="/billing/reconciliation"
                    className="text-sm underline"
                >
                    {t('admin-billing.proposedRefunds.marksLink')}
                </a>
            </section>
            <ProposedRefundActions
                refund={refund}
                amountLabel={amountLabel}
            />
        </article>
    );
}

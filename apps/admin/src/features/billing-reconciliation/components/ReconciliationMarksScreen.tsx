import type { TranslationKey } from '@repo/i18n';
import { formatCurrency } from '@repo/i18n';
import type { ReconciliationMarkListResponseSchema } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import type { z } from 'zod';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import { useReconciliationMarks } from '../hooks/useReconciliationMarks';
import { LiftReconciliationMarkAction } from './LiftReconciliationMarkAction';
import { ReconciliationMarkAction14 } from './ReconciliationMarkAction14';

type Mark = z.infer<typeof ReconciliationMarkListResponseSchema>['items'][number];
const PAGE_SIZE = 50;

/** Displays the API's actionable marks and preserves its order and proposals. */
export function ReconciliationMarksScreen() {
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]}>
            <MarksBody />
        </PermissionGate>
    );
}

function MarksBody() {
    const { t, locale } = useTranslations();
    const [page, setPage] = useState(1);
    const query = useReconciliationMarks({ page, pageSize: PAGE_SIZE });
    if (query.isLoading) return <p>{t('admin-billing.reconciliationMarks.loading')}</p>;
    if (query.isError)
        return (
            <div
                role="alert"
                className="space-y-2"
            >
                <p>{t('admin-billing.reconciliationMarks.error')}</p>
                <Button onClick={() => void query.refetch()}>
                    {t('admin-billing.reconciliationMarks.retry')}
                </Button>
            </div>
        );
    const data = query.data;
    if (!data || data.items.length === 0)
        return <p>{t('admin-billing.reconciliationMarks.empty')}</p>;
    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <div className="space-y-4">
                    {data.items.map((mark) => (
                        <MarkArticle
                            key={mark.markId}
                            mark={mark}
                            locale={locale}
                            t={t}
                        />
                    ))}
                </div>
                <nav
                    aria-label={t('admin-billing.reconciliationMarks.pagination')}
                    className="flex items-center justify-between"
                >
                    <span>{data.pagination.total}</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={page <= 1}
                            onClick={() => setPage((current) => current - 1)}
                        >
                            {t('admin-billing.reconciliationMarks.previous')}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={page >= data.pagination.totalPages}
                            onClick={() => setPage((current) => current + 1)}
                        >
                            {t('admin-billing.reconciliationMarks.next')}
                        </Button>
                    </div>
                </nav>
            </CardContent>
        </Card>
    );
}

function MarkArticle({
    mark,
    locale,
    t
}: {
    mark: Mark;
    locale: string;
    t: (key: TranslationKey) => string;
}) {
    const proposals: Record<Mark['defaultProposal'], TranslationKey> = {
        REFUND: 'admin-billing.reconciliationMarks.proposals.refund',
        REFUND_DIFFERENCE: 'admin-billing.reconciliationMarks.proposals.refundDifference',
        NO_REFUND: 'admin-billing.reconciliationMarks.proposals.noRefund',
        NONE: 'admin-billing.reconciliationMarks.proposals.none'
    };
    return (
        <article
            data-testid="reconciliation-mark"
            data-mark-id={mark.markId}
            data-reason={mark.reason}
            className="space-y-2 rounded-md border p-4"
        >
            <h2 className="font-semibold">
                {mark.reasonNumber} · {mark.reason}
            </h2>
            <p>
                {t('admin-billing.reconciliationMarks.openedAt')}:{' '}
                {formatDateWithTime({ date: mark.openedAt, locale })}
            </p>
            <p data-testid="reconciliation-mark-subject-status">
                {t('admin-billing.reconciliationMarks.subjectStatus')}:{' '}
                {mark.subject.status ?? t('admin-billing.reconciliationMarks.subjectUnresolved')}
            </p>
            <p data-testid="reconciliation-mark-proposal">
                {t('admin-billing.reconciliationMarks.proposal')}:{' '}
                {t(proposals[mark.defaultProposal])}
            </p>
            {mark.refundConfirmation ? (
                <p>{t('admin-billing.reconciliationMarks.refundNotice')}</p>
            ) : null}
            {mark.payments.map((payment) => (
                <div
                    data-testid="reconciliation-mark-payment"
                    key={`${payment.source}-${payment.paymentId}`}
                    className="text-sm"
                >
                    {t(
                        `admin-billing.reconciliationMarks.sources.${payment.source === 'PAYMENT' ? 'card' : 'manual'}`
                    )}{' '}
                    ·{' '}
                    {payment.amountMinor === null || payment.currency === null
                        ? t('admin-billing.reconciliationMarks.unknownAmount')
                        : formatCurrency({
                              value: payment.amountMinor / 100,
                              currency: payment.currency,
                              locale
                          })}{' '}
                    · {payment.status} · {formatDateWithTime({ date: payment.hungAt, locale })}
                </div>
            ))}
            <p data-testid="reconciliation-mark-payment-count">
                {t('admin-billing.reconciliationMarks.paymentCount')}: {mark.paymentCount}
            </p>
            {mark.totalAmount.map((total) => (
                <p
                    data-testid="reconciliation-mark-total"
                    key={total.currency}
                >
                    {t('admin-billing.reconciliationMarks.total')}:{' '}
                    {formatCurrency({
                        value: total.amountMinor / 100,
                        currency: total.currency,
                        locale
                    })}
                </p>
            ))}
            {mark.eventLink === null ? null : (
                <a
                    data-testid="reconciliation-mark-event-link"
                    href={`/billing/reconciliation/${mark.markId}/events`}
                >
                    {t('admin-billing.reconciliationMarks.eventLink')}
                </a>
            )}
            <ReconciliationMarkAction14 mark={mark} />
            <LiftReconciliationMarkAction
                mark={mark}
                locale={locale}
            />
        </article>
    );
}

/**
 * @file StuckRefundsList.tsx
 * «Devoluciones trabadas» (HOS-2560): the confirmed refunds stuck on a live provider call, each with
 * the one action the list suggests for it.
 */

import type { TranslationKey } from '@repo/i18n';
import type { StuckRefund, StuckRefundListResponse } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import { formatProposedRefundAmount } from '../refund-amount';
import { formatStuckRefundAge } from '../stuck-refund-format';

const BASE = 'admin-billing.proposedRefunds.stuck';

type Translate = (key: TranslationKey, params?: Record<string, unknown>) => string;

/** Props of {@link StuckRefundsList}. */
export type StuckRefundsListProps = {
    readonly data: StuckRefundListResponse | undefined;
    readonly isLoading: boolean;
    readonly isError: boolean;
    readonly onRetryLoad: () => void;
    readonly page: number;
    readonly onPageChange: (page: number) => void;
    /** Whether the person may run the remainder settlement (BILLING_SETTLE_EXTERNAL). */
    readonly canSettle: boolean;
    /** A row's action button: picks the refund in the matching form. */
    readonly onAction: (input: {
        readonly refundId: string;
        readonly action: NonNullable<StuckRefund['suggestedAction']>;
    }) => void;
};

/** Renders the stuck-refund section. */
export function StuckRefundsList(props: StuckRefundsListProps) {
    const { t, locale } = useTranslations();
    const { data } = props;
    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <section
                    data-testid="stuck-refunds"
                    aria-labelledby="stuck-refunds-title"
                    className="space-y-4"
                >
                    <h2
                        id="stuck-refunds-title"
                        className="font-semibold"
                    >
                        {t(`${BASE}.title`)}
                    </h2>
                    <p className="text-muted-foreground text-sm">{t(`${BASE}.description`)}</p>
                    {props.isLoading ? (
                        <p>{t(`${BASE}.loading`)}</p>
                    ) : props.isError ? (
                        <div
                            role="alert"
                            className="space-y-2"
                        >
                            <p>{t(`${BASE}.error`)}</p>
                            <Button onClick={props.onRetryLoad}>
                                {t('admin-billing.proposedRefunds.retry')}
                            </Button>
                        </div>
                    ) : !data || data.items.length === 0 ? (
                        <p data-testid="stuck-refunds-empty">{t(`${BASE}.empty`)}</p>
                    ) : (
                        <>
                            <ul className="space-y-3">
                                {data.items.map((refund) => (
                                    <StuckRefundRow
                                        key={refund.refundId}
                                        refund={refund}
                                        locale={locale}
                                        t={t}
                                        canSettle={props.canSettle}
                                        onAction={props.onAction}
                                    />
                                ))}
                            </ul>
                            <nav
                                aria-label={t(`${BASE}.pagination`)}
                                className="flex items-center justify-between"
                            >
                                <span>{data.pagination.total}</span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        disabled={props.page <= 1}
                                        onClick={() => props.onPageChange(props.page - 1)}
                                    >
                                        {t('admin-billing.proposedRefunds.previous')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        disabled={props.page >= data.pagination.totalPages}
                                        onClick={() => props.onPageChange(props.page + 1)}
                                    >
                                        {t('admin-billing.proposedRefunds.next')}
                                    </Button>
                                </div>
                            </nav>
                        </>
                    )}
                </section>
            </CardContent>
        </Card>
    );
}

function StuckRefundRow({
    refund,
    locale,
    t,
    canSettle,
    onAction
}: {
    readonly refund: StuckRefund;
    readonly locale: string;
    readonly t: Translate;
    readonly canSettle: boolean;
    readonly onAction: StuckRefundsListProps['onAction'];
}) {
    const action = refund.suggestedAction;
    const showAction = action === 'RETRY' || (action === 'SETTLE_REMAINDER' && canSettle);
    return (
        <li
            data-testid="stuck-refund"
            data-refund-id={refund.refundId}
            data-suggested-action={action ?? 'NONE'}
            className="space-y-1 rounded-md border p-4"
        >
            <p className="font-semibold">
                {t('admin-billing.proposedRefunds.amount')}:{' '}
                {formatProposedRefundAmount({
                    amountMinor: refund.amountMinor,
                    currency: refund.currency,
                    locale
                })}
            </p>
            <p>
                {t('admin-billing.proposedRefunds.payment')}:{' '}
                {t(
                    `admin-billing.reconciliationMarks.sources.${refund.payment.source === 'PAYMENT' ? 'card' : 'manual'}`
                )}{' '}
                · {refund.payment.id}
            </p>
            <p>
                {t(`${BASE}.createdAt`)}: {formatDateWithTime({ date: refund.createdAt, locale })}
            </p>
            <p data-testid="stuck-refund-calls">
                {t(`${BASE}.calls`, {
                    count: refund.unansweredCallCount,
                    total: refund.providerCallCount
                })}
                {refund.oldestUnansweredAt
                    ? ` · ${t(`${BASE}.oldestUnanswered`, {
                          age: formatStuckRefundAge({
                              since: refund.oldestUnansweredAt,
                              now: new Date(),
                              t
                          })
                      })}`
                    : null}
            </p>
            {refund.acceptedAmountMinor > 0 ? (
                <p data-testid="stuck-refund-accepted">
                    {t(`${BASE}.accepted`, {
                        amount: formatProposedRefundAmount({
                            amountMinor: refund.acceptedAmountMinor,
                            currency: refund.currency,
                            locale
                        })
                    })}
                </p>
            ) : null}
            {action === null ? (
                <p className="text-muted-foreground text-sm">{t(`${BASE}.noAction`)}</p>
            ) : showAction ? (
                <Button
                    size="sm"
                    onClick={() => onAction({ refundId: refund.refundId, action })}
                >
                    {t(`${BASE}.actions.${action}`)}
                </Button>
            ) : null}
        </li>
    );
}

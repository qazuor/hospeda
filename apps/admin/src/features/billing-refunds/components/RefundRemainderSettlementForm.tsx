/**
 * @file RefundRemainderSettlementForm.tsx
 * Action 14 over a `CONFIRMED` refund the provider accepted only in part (HOS-2406), or stuck on a
 * provider call unanswered for more than 24 hours that «Retry with MP» no longer resends (HOS-2538):
 * the person records what they refunded by hand from the MP panel, and the refund closes.
 */

import type { TranslationKey } from '@repo/i18n';
import {
    type RefundRemainderSettlementRequest,
    RefundRemainderSettlementRequestSchema
} from '@repo/schemas';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import {
    Action14Field,
    readAction14Rejection
} from '../../billing-reconciliation/components/action14-shared';
import { useSettleRefundRemainder } from '../hooks/useSettleRefundRemainder';

/** Rejections only the remainder settlement answers; the rest reuse action 14's messages. */
const REMAINDER_REJECTION_KEYS: Readonly<Record<string, TranslationKey>> = {
    REFUND_NOT_CONFIRMED: 'admin-billing.proposedRefunds.remainder.rejections.REFUND_NOT_CONFIRMED',
    REFUND_CALL_UNANSWERED:
        'admin-billing.proposedRefunds.remainder.rejections.REFUND_CALL_UNANSWERED',
    REFUND_HAS_NO_ACCEPTED_CALL:
        'admin-billing.proposedRefunds.remainder.rejections.REFUND_HAS_NO_ACCEPTED_CALL',
    REMAINDER_AMOUNT_MISMATCH:
        'admin-billing.proposedRefunds.remainder.rejections.REMAINDER_AMOUNT_MISMATCH',
    ACCEPTED_PART_NOT_ACCREDITED:
        'admin-billing.proposedRefunds.remainder.rejections.ACCEPTED_PART_NOT_ACCREDITED',
    REMAINDER_NOT_FOUND_AT_PROVIDER:
        'admin-billing.proposedRefunds.remainder.rejections.REMAINDER_NOT_FOUND_AT_PROVIDER',
    OTHER_REFUND_CALL_UNANSWERED:
        'admin-billing.proposedRefunds.remainder.rejections.OTHER_REFUND_CALL_UNANSWERED',
    UNCITED_PROVIDER_REFUND_ON_CHARGE:
        'admin-billing.proposedRefunds.remainder.rejections.UNCITED_PROVIDER_REFUND_ON_CHARGE'
};

const RefundIdSchema = z.string().uuid();

/**
 * Maps a remainder settlement error to its localized message.
 *
 * @param input - The thrown error.
 * @returns The translation key to show.
 */
export function readRemainderRejection({ error }: { readonly error: unknown }): TranslationKey {
    const payload = isApiError(error) ? error.body : null;
    const reason = (payload as { error?: { reason?: string } } | null)?.error?.reason;
    return (
        (reason ? REMAINDER_REJECTION_KEYS[reason] : undefined) ?? readAction14Rejection({ error })
    );
}

/** Renders the remainder settlement form. */
export function RefundRemainderSettlementForm() {
    const { t, locale } = useTranslations();
    const mutation = useSettleRefundRemainder();
    const [refundId, setRefundId] = useState('');
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState('');
    const [note, setNote] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const trimmedId = refundId.trim();
    const body: RefundRemainderSettlementRequest = {
        amount: Math.round(Number(amount) * 100),
        reference: reference.trim(),
        ...(note.trim() ? { note: note.trim() } : {})
    };
    const valid =
        RefundIdSchema.safeParse(trimmedId).success &&
        RefundRemainderSettlementRequestSchema.safeParse(body).success;
    const money = (minor: number) =>
        new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(minor / 100);
    const confirm = async () => {
        setErrorKey(null);
        try {
            const response = await mutation.mutateAsync({ refundId: trimmedId, body });
            setResult(
                t('admin-billing.proposedRefunds.remainder.success', {
                    accepted: money(response.acceptedAmount),
                    remainder: money(response.remainderAmount)
                })
            );
        } catch (error) {
            setErrorKey(readRemainderRejection({ error }));
            setConfirming(false);
        }
    };
    return (
        <Card>
            <CardContent className="space-y-3 pt-6">
                <section
                    data-testid="refund-remainder-settlement"
                    className="space-y-3"
                >
                    <h2 className="font-semibold">
                        {t('admin-billing.proposedRefunds.remainder.title')}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {t('admin-billing.proposedRefunds.remainder.description')}
                    </p>
                    {result ? (
                        <p role="status">{result}</p>
                    ) : confirming ? (
                        <div className="space-y-2">
                            <p data-testid="refund-remainder-confirmation">
                                {t('admin-billing.proposedRefunds.remainder.confirmText', {
                                    amount: money(body.amount),
                                    reference: body.reference,
                                    refundId: trimmedId
                                })}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    disabled={mutation.isPending}
                                    onClick={() => void confirm()}
                                >
                                    {t('admin-billing.proposedRefunds.remainder.confirm')}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirming(false)}
                                >
                                    {t('admin-billing.proposedRefunds.remainder.back')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Action14Field
                                label={t('admin-billing.proposedRefunds.remainder.refundId')}
                                value={refundId}
                                onChange={setRefundId}
                            />
                            <Action14Field
                                label={t('admin-billing.proposedRefunds.remainder.amount')}
                                value={amount}
                                onChange={setAmount}
                                type="number"
                            />
                            <Action14Field
                                label={t('admin-billing.proposedRefunds.remainder.reference')}
                                value={reference}
                                onChange={setReference}
                            />
                            <Action14Field
                                label={t('admin-billing.proposedRefunds.remainder.note')}
                                value={note}
                                onChange={setNote}
                            />
                            <Button
                                disabled={!valid}
                                onClick={() => {
                                    setErrorKey(null);
                                    setConfirming(true);
                                }}
                            >
                                {t('admin-billing.proposedRefunds.remainder.review')}
                            </Button>
                        </div>
                    )}
                    {errorKey ? <p role="alert">{t(errorKey)}</p> : null}
                </section>
            </CardContent>
        </Card>
    );
}

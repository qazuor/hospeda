import type { TranslationKey } from '@repo/i18n';
import {
    type ExternalRefundSettlementRequest,
    ExternalRefundSettlementRequestSchema,
    type ExternalRefundSettlementResponse
} from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { useSettleExternalRefund } from '../hooks/useSettleExternal';
import { Action14Field, readAction14Rejection } from './action14-shared';

/** Payment prefilled into action 14. */
export interface ExternalRefundSettlementPayment {
    readonly paymentId: string;
    readonly source: 'PAYMENT' | 'MANUAL_PAYMENT';
    readonly amountMinor: number | null;
}

/** Props for {@link ExternalRefundSettlementForm}. RO-RO. */
export interface ExternalRefundSettlementFormProps {
    /** Suffix of the element ids (`action14-payment-<idSuffix>` ...). */
    readonly idSuffix: string;
    /** `data-testid` of the section; the confirmation is `<testId>-confirmation`. */
    readonly testId: string;
    /** Optional `data-reason` of the section (the mark path sets it). */
    readonly dataReason?: string;
    readonly payments: readonly ExternalRefundSettlementPayment[];
    readonly defaultChannel: 'BANK_TRANSFER' | 'PROVIDER_PANEL';
    /** The open RF1 this settlement closes (AC:B5:41); absent on the mark path. */
    readonly requestedRefund?: { readonly refundId: string; readonly amountMinor: number };
    readonly describeSuccess: (input: {
        readonly response: ExternalRefundSettlementResponse;
    }) => string;
}

/** Renders the shared action 14 refund settlement form. */
export function ExternalRefundSettlementForm({
    idSuffix,
    testId,
    dataReason,
    payments,
    defaultChannel,
    requestedRefund,
    describeSuccess
}: ExternalRefundSettlementFormProps) {
    const { t } = useTranslations();
    const mutation = useSettleExternalRefund();
    const [selectedId, setSelectedId] = useState(payments[0]?.paymentId ?? '');
    const [amount, setAmount] = useState(() =>
        payments[0]?.amountMinor == null ? '' : (payments[0].amountMinor / 100).toFixed(2)
    );
    const [channel, setChannel] = useState(defaultChannel);
    const [reference, setReference] = useState('');
    const [scope, setScope] = useState<'TOTAL' | 'PARTIAL'>('TOTAL');
    const [note, setNote] = useState('');
    const [choice, setChoice] = useState<'CLOSE_WITH_SETTLED_AMOUNT' | 'SETTLE_SEPARATELY' | ''>(
        ''
    );
    const [confirming, setConfirming] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const payment = payments.find(({ paymentId }) => paymentId === selectedId);
    const source = payment?.source ?? 'PAYMENT';
    const amountMinor = Math.round(Number(amount) * 100);
    const differs = requestedRefund !== undefined && amountMinor !== requestedRefund.amountMinor;
    const body: ExternalRefundSettlementRequest = {
        ...(source === 'PAYMENT'
            ? { paymentId: selectedId }
            : { manualPaymentId: selectedId, manualPaymentScope: scope }),
        amount: amountMinor,
        channel,
        reference,
        reason: source === 'PAYMENT' ? 'OUT_OF_FLOW_REFUND' : 'MANUAL_PAYMENT_REFUND',
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(requestedRefund ? { refundId: requestedRefund.refundId } : {}),
        ...(differs && choice ? { onAmountMismatch: choice } : {})
    };
    const valid = ExternalRefundSettlementRequestSchema.safeParse(body).success;
    const confirmText = t('admin-billing.reconciliationMarks.action14.confirmRefund', {
        amount,
        channel: t(
            `admin-billing.reconciliationMarks.action14.channels.${channel}` as TranslationKey
        ),
        reference
    });
    const confirm = async () => {
        setErrorKey(null);
        try {
            setResult(describeSuccess({ response: await mutation.mutateAsync(body) }));
        } catch (error) {
            setErrorKey(readAction14Rejection({ error }));
            setConfirming(false);
            setChoice('');
        }
    };
    return (
        <section
            data-testid={testId}
            data-reason={dataReason}
            className="space-y-3 border-t pt-3"
        >
            <h3 className="font-semibold">
                {t('admin-billing.reconciliationMarks.action14.title')}
            </h3>
            {result ? (
                <p role="status">{result}</p>
            ) : confirming ? (
                <div className="space-y-2">
                    <p data-testid={`${testId}-confirmation`}>{confirmText}</p>
                    {differs && requestedRefund ? (
                        <fieldset className="space-y-2">
                            <legend>
                                {t(
                                    'admin-billing.subscriptionRevocation.settlement.mismatch.notice',
                                    {
                                        amount: Number(amount).toFixed(2),
                                        requested: (requestedRefund.amountMinor / 100).toFixed(2)
                                    }
                                )}
                            </legend>
                            {(['CLOSE_WITH_SETTLED_AMOUNT', 'SETTLE_SEPARATELY'] as const).map(
                                (value) => (
                                    <label
                                        key={value}
                                        className="flex gap-2"
                                    >
                                        <input
                                            type="radio"
                                            name={`${testId}-mismatch`}
                                            value={value}
                                            checked={choice === value}
                                            onChange={() => setChoice(value)}
                                        />
                                        {t(
                                            `admin-billing.subscriptionRevocation.settlement.mismatch.${value}` as TranslationKey
                                        )}
                                    </label>
                                )
                            )}
                        </fieldset>
                    ) : null}
                    <Button
                        disabled={mutation.isPending || (differs && !choice)}
                        onClick={() => void confirm()}
                    >
                        {t('admin-billing.reconciliationMarks.action14.confirm')}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setConfirming(false);
                            setChoice('');
                        }}
                    >
                        {t('admin-billing.reconciliationMarks.action14.back')}
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {payments.length > 1 ? (
                        <div className="space-y-1">
                            <Label htmlFor={`action14-payment-${idSuffix}`}>
                                {t('admin-billing.reconciliationMarks.action14.payment')}
                            </Label>
                            <select
                                id={`action14-payment-${idSuffix}`}
                                className="w-full rounded-md border bg-background p-2"
                                value={selectedId}
                                onChange={(event) => {
                                    setSelectedId(event.target.value);
                                    const next = payments.find(
                                        ({ paymentId }) => paymentId === event.target.value
                                    );
                                    setAmount(
                                        next?.amountMinor == null
                                            ? ''
                                            : (next.amountMinor / 100).toFixed(2)
                                    );
                                }}
                            >
                                {payments.map((item) => (
                                    <option
                                        key={item.paymentId}
                                        value={item.paymentId}
                                    >
                                        {item.source} · {item.paymentId}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <p className="self-end text-sm">
                            {t('admin-billing.reconciliationMarks.action14.payment')}: {selectedId}
                        </p>
                    )}
                    <Action14Field
                        label={t('admin-billing.reconciliationMarks.action14.amount')}
                        value={amount}
                        onChange={setAmount}
                        type="number"
                    />
                    {source === 'MANUAL_PAYMENT' ? (
                        <div className="space-y-1">
                            <Label htmlFor={`action14-scope-${idSuffix}`}>
                                {t('admin-billing.reconciliationMarks.action14.scope')}
                            </Label>
                            <select
                                id={`action14-scope-${idSuffix}`}
                                className="w-full rounded-md border bg-background p-2"
                                value={scope}
                                onChange={(event) =>
                                    setScope(event.target.value as 'TOTAL' | 'PARTIAL')
                                }
                            >
                                <option value="TOTAL">TOTAL</option>
                                <option value="PARTIAL">PARTIAL</option>
                            </select>
                        </div>
                    ) : null}
                    <div className="space-y-1">
                        <Label htmlFor={`action14-channel-${idSuffix}`}>
                            {t('admin-billing.reconciliationMarks.action14.channel')}
                        </Label>
                        <select
                            id={`action14-channel-${idSuffix}`}
                            className="w-full rounded-md border bg-background p-2"
                            value={channel}
                            onChange={(event) => setChannel(event.target.value as typeof channel)}
                        >
                            <option value="BANK_TRANSFER">
                                {t(
                                    'admin-billing.reconciliationMarks.action14.channels.BANK_TRANSFER'
                                )}
                            </option>
                            <option value="PROVIDER_PANEL">
                                {t(
                                    'admin-billing.reconciliationMarks.action14.channels.PROVIDER_PANEL'
                                )}
                            </option>
                        </select>
                    </div>
                    <Action14Field
                        label={t('admin-billing.reconciliationMarks.action14.reference')}
                        value={reference}
                        onChange={setReference}
                    />
                    <Action14Field
                        label={t('admin-billing.reconciliationMarks.action14.note')}
                        value={note}
                        onChange={setNote}
                    />
                    <Button
                        disabled={!valid}
                        onClick={() => {
                            setErrorKey(null);
                            setConfirming(true);
                            setChoice('');
                        }}
                    >
                        {t('admin-billing.reconciliationMarks.action14.review')}
                    </Button>
                </div>
            )}
            {errorKey ? <p role="alert">{t(errorKey)}</p> : null}
        </section>
    );
}

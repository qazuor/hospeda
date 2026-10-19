/**
 * @file ReconciliationMarkAction14.tsx
 * Offers administrative action 14 for refund and unrecorded-charge marks.
 */

import type { TranslationKey } from '@repo/i18n';
import {
    type ExternalRefundSettlementRequest,
    ExternalRefundSettlementRequestSchema,
    PermissionEnum,
    type ReconciliationMarkListResponseSchema
} from '@repo/schemas';
import { useId, useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { isApiError } from '@/lib/errors';
import { useSettleExternalCharge, useSettleExternalRefund } from '../hooks/useSettleExternal';

type Mark = z.infer<typeof ReconciliationMarkListResponseSchema>['items'][number];
type Source = 'PAYMENT' | 'MANUAL_PAYMENT';
type Mode = 'refund' | 'charge' | null;

const MODE_BY_REASON: Record<string, Mode> = {
    REEMBOLSO_FUERA_DEL_FLUJO: 'refund',
    COBRO_SIN_REGISTRAR: 'charge'
};

const REJECTION_KEYS: Readonly<Record<string, TranslationKey>> = {
    REFUND_AMOUNT_INVALID:
        'admin-billing.reconciliationMarks.action14.rejections.REFUND_AMOUNT_INVALID',
    EXTERNAL_REFERENCE_INVALID:
        'admin-billing.reconciliationMarks.action14.rejections.EXTERNAL_REFERENCE_INVALID',
    REFUND_EXCEEDS_BALANCE:
        'admin-billing.reconciliationMarks.action14.rejections.REFUND_EXCEEDS_BALANCE',
    MANUAL_PAYMENT_SCOPE_REQUIRED:
        'admin-billing.reconciliationMarks.action14.rejections.MANUAL_PAYMENT_SCOPE_REQUIRED',
    MANUAL_PAYMENT_SCOPE_NOT_ALLOWED:
        'admin-billing.reconciliationMarks.action14.rejections.MANUAL_PAYMENT_SCOPE_NOT_ALLOWED',
    REFUND_SOURCE_NOT_FOUND:
        'admin-billing.reconciliationMarks.action14.rejections.REFUND_SOURCE_NOT_FOUND',
    REFUND_NOT_FOUND: 'admin-billing.reconciliationMarks.action14.rejections.REFUND_NOT_FOUND',
    ADMINISTRATIVE_ACTION_FORBIDDEN:
        'admin-billing.reconciliationMarks.action14.rejections.ADMINISTRATIVE_ACTION_FORBIDDEN',
    PAYMENT_NOT_REFUNDABLE:
        'admin-billing.reconciliationMarks.action14.rejections.PAYMENT_NOT_REFUNDABLE',
    REQUESTED_AMOUNT_MISMATCH:
        'admin-billing.reconciliationMarks.action14.rejections.REQUESTED_AMOUNT_MISMATCH',
    OPEN_REQUESTS_AMBIGUOUS:
        'admin-billing.reconciliationMarks.action14.rejections.OPEN_REQUESTS_AMBIGUOUS',
    REFUND_NOT_OPEN: 'admin-billing.reconciliationMarks.action14.rejections.REFUND_NOT_OPEN',
    REFUND_STATE_CHANGED:
        'admin-billing.reconciliationMarks.action14.rejections.REFUND_STATE_CHANGED',
    EXTERNAL_REFERENCE_ALREADY_SETTLED:
        'admin-billing.reconciliationMarks.action14.rejections.EXTERNAL_REFERENCE_ALREADY_SETTLED',
    RETAINED_PAYMENT_SUCCESSION_OPEN:
        'admin-billing.reconciliationMarks.action14.rejections.RETAINED_PAYMENT_SUCCESSION_OPEN',
    CHARGE_NOT_FOUND: 'admin-billing.reconciliationMarks.action14.rejections.CHARGE_NOT_FOUND',
    CHARGE_NOT_LINKED: 'admin-billing.reconciliationMarks.action14.rejections.CHARGE_NOT_LINKED',
    CHARGE_NOT_SETTLEABLE:
        'admin-billing.reconciliationMarks.action14.rejections.CHARGE_NOT_SETTLEABLE',
    CHARGE_NOT_APPROVED:
        'admin-billing.reconciliationMarks.action14.rejections.CHARGE_NOT_APPROVED',
    CHARGE_ALREADY_RECORDED:
        'admin-billing.reconciliationMarks.action14.rejections.CHARGE_ALREADY_RECORDED'
};

/** Renders the permission-gated action belonging to this mark's reason. */
export function ReconciliationMarkAction14({ mark }: { readonly mark: Mark }) {
    const allowed = useHasPermission(PermissionEnum.BILLING_SETTLE_EXTERNAL);
    const mode = MODE_BY_REASON[mark.reason] ?? null;
    if (!allowed || mode === null) return null;
    return mode === 'refund' ? <RefundAction mark={mark} /> : <ChargeAction />;
}

function RefundAction({ mark }: { readonly mark: Mark }) {
    const { t } = useTranslations();
    const mutation = useSettleExternalRefund();
    const [selectedId, setSelectedId] = useState(mark.payments[0]?.paymentId ?? '');
    const [amount, setAmount] = useState(() => {
        const payment = mark.payments.find(({ paymentId }) => paymentId === selectedId);
        return payment?.amountMinor === null || payment?.amountMinor === undefined
            ? ''
            : (payment.amountMinor / 100).toFixed(2);
    });
    const [channel, setChannel] = useState<'BANK_TRANSFER' | 'PROVIDER_PANEL'>('BANK_TRANSFER');
    const [reference, setReference] = useState('');
    const [scope, setScope] = useState<'TOTAL' | 'PARTIAL'>('TOTAL');
    const [note, setNote] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const payment = mark.payments.find(({ paymentId }) => paymentId === selectedId);
    const source: Source = payment?.source ?? 'PAYMENT';
    const amountNumber = Number(amount);
    // Currency input is major units; the contract requires an integer count of cents.
    const amountMinor = Math.round(amountNumber * 100);
    const body: ExternalRefundSettlementRequest = {
        ...(source === 'PAYMENT'
            ? { paymentId: selectedId }
            : { manualPaymentId: selectedId, manualPaymentScope: scope }),
        amount: amountMinor,
        channel,
        reference,
        reason: source === 'PAYMENT' ? 'OUT_OF_FLOW_REFUND' : 'MANUAL_PAYMENT_REFUND',
        ...(note.trim() ? { note: note.trim() } : {})
    };
    const valid = ExternalRefundSettlementRequestSchema.safeParse(body).success;
    const rejection = (error: unknown): TranslationKey => {
        if (isApiError(error) && error.status >= 500)
            return 'admin-billing.reconciliationMarks.action14.serverError';
        const payload = isApiError(error) ? error.body : null;
        const reason =
            (payload as { error?: { reason?: string }; reason?: string } | null)?.error?.reason ??
            (payload as { reason?: string } | null)?.reason;
        return (
            (reason ? REJECTION_KEYS[reason] : undefined) ??
            'admin-billing.reconciliationMarks.action14.genericError'
        );
    };
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
            const response = await mutation.mutateAsync(body);
            setResult(
                t('admin-billing.reconciliationMarks.action14.refundSuccess', {
                    refundId: response.refundId,
                    status: response.status
                })
            );
        } catch (error) {
            setErrorKey(rejection(error));
            setConfirming(false);
        }
    };

    return (
        <section
            data-testid="reconciliation-mark-action14"
            data-reason={mark.reason}
            className="space-y-3 border-t pt-3"
        >
            <h3 className="font-semibold">
                {t('admin-billing.reconciliationMarks.action14.title')}
            </h3>
            {result ? (
                <p role="status">{result}</p>
            ) : confirming ? (
                <div className="space-y-2">
                    <p data-testid="reconciliation-mark-action14-confirmation">{confirmText}</p>
                    <Button
                        disabled={mutation.isPending}
                        onClick={() => void confirm()}
                    >
                        {t('admin-billing.reconciliationMarks.action14.confirm')}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setConfirming(false)}
                    >
                        {t('admin-billing.reconciliationMarks.action14.back')}
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {mark.payments.length > 1 ? (
                        <div className="space-y-1">
                            <Label htmlFor={`action14-payment-${mark.markId}`}>
                                {t('admin-billing.reconciliationMarks.action14.payment')}
                            </Label>
                            <select
                                id={`action14-payment-${mark.markId}`}
                                className="w-full rounded-md border bg-background p-2"
                                value={selectedId}
                                onChange={(event) => {
                                    setSelectedId(event.target.value);
                                    const next = mark.payments.find(
                                        ({ paymentId }) => paymentId === event.target.value
                                    );
                                    setAmount(
                                        next?.amountMinor === null ||
                                            next?.amountMinor === undefined
                                            ? ''
                                            : (next.amountMinor / 100).toFixed(2)
                                    );
                                }}
                            >
                                {mark.payments.map((item) => (
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
                    <Field
                        label={t('admin-billing.reconciliationMarks.action14.amount')}
                        value={amount}
                        onChange={setAmount}
                        type="number"
                    />
                    {source === 'MANUAL_PAYMENT' ? (
                        <div className="space-y-1">
                            <Label htmlFor={`action14-scope-${mark.markId}`}>
                                {t('admin-billing.reconciliationMarks.action14.scope')}
                            </Label>
                            <select
                                id={`action14-scope-${mark.markId}`}
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
                        <Label htmlFor={`action14-channel-${mark.markId}`}>
                            {t('admin-billing.reconciliationMarks.action14.channel')}
                        </Label>
                        <select
                            id={`action14-channel-${mark.markId}`}
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
                    <Field
                        label={t('admin-billing.reconciliationMarks.action14.reference')}
                        value={reference}
                        onChange={setReference}
                    />
                    <Field
                        label={t('admin-billing.reconciliationMarks.action14.note')}
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
                        {t('admin-billing.reconciliationMarks.action14.review')}
                    </Button>
                </div>
            )}
            {errorKey ? <p role="alert">{t(errorKey)}</p> : null}
        </section>
    );
}

function ChargeAction() {
    const { t } = useTranslations();
    const mutation = useSettleExternalCharge();
    const [chargeId, setChargeId] = useState('');
    const [note, setNote] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const body = { chargeId, ...(note.trim() ? { note: note.trim() } : {}) };
    const rejection = (error: unknown): TranslationKey => {
        if (isApiError(error) && error.status >= 500)
            return 'admin-billing.reconciliationMarks.action14.serverError';
        const payload = isApiError(error) ? error.body : null;
        const reason =
            (payload as { error?: { reason?: string }; reason?: string } | null)?.error?.reason ??
            (payload as { reason?: string } | null)?.reason;
        return (
            (reason ? REJECTION_KEYS[reason] : undefined) ??
            'admin-billing.reconciliationMarks.action14.genericError'
        );
    };
    const confirm = async () => {
        setErrorKey(null);
        try {
            const response = await mutation.mutateAsync(body);
            setResult(
                t('admin-billing.reconciliationMarks.action14.chargeSuccess', {
                    paymentId: response.paymentId,
                    reception: response.reception
                })
            );
        } catch (error) {
            setErrorKey(rejection(error));
            setConfirming(false);
        }
    };
    return (
        <section
            data-testid="reconciliation-mark-action14"
            data-reason="COBRO_SIN_REGISTRAR"
            className="space-y-3 border-t pt-3"
        >
            <h3 className="font-semibold">
                {t('admin-billing.reconciliationMarks.action14.title')}
            </h3>
            {result ? (
                <p role="status">{result}</p>
            ) : confirming ? (
                <div className="space-y-2">
                    <p data-testid="reconciliation-mark-action14-confirmation">
                        {t('admin-billing.reconciliationMarks.action14.confirmCharge', {
                            chargeId
                        })}
                    </p>
                    <Button
                        disabled={mutation.isPending}
                        onClick={() => void confirm()}
                    >
                        {t('admin-billing.reconciliationMarks.action14.confirm')}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setConfirming(false)}
                    >
                        {t('admin-billing.reconciliationMarks.action14.back')}
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                        label={t('admin-billing.reconciliationMarks.action14.chargeId')}
                        value={chargeId}
                        onChange={setChargeId}
                    />
                    <Field
                        label={t('admin-billing.reconciliationMarks.action14.note')}
                        value={note}
                        onChange={setNote}
                    />
                    <Button
                        disabled={!chargeId.trim()}
                        onClick={() => {
                            setErrorKey(null);
                            setConfirming(true);
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

function Field({
    label,
    value,
    onChange,
    type = 'text'
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
}) {
    const id = useId();
    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

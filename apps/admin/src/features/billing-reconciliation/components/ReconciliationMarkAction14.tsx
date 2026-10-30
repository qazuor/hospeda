/**
 * @file ReconciliationMarkAction14.tsx
 * Offers administrative action 14 for refund and unrecorded-charge marks.
 */

import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type ReconciliationMarkListResponseSchema } from '@repo/schemas';
import { useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { useSettleExternalCharge } from '../hooks/useSettleExternal';
import { Action14Field, readAction14Rejection } from './action14-shared';
import { ExternalRefundSettlementForm } from './ExternalRefundSettlementForm';

type Mark = z.infer<typeof ReconciliationMarkListResponseSchema>['items'][number];
type Mode = 'refund' | 'charge' | null;

const MODE_BY_REASON: Record<string, Mode> = {
    REEMBOLSO_FUERA_DEL_FLUJO: 'refund',
    COBRO_SIN_REGISTRAR: 'charge'
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
    return (
        <ExternalRefundSettlementForm
            idSuffix={mark.markId}
            testId="reconciliation-mark-action14"
            dataReason={mark.reason}
            payments={mark.payments.map(({ paymentId, source, amountMinor }) => ({
                paymentId,
                source,
                amountMinor
            }))}
            defaultChannel="BANK_TRANSFER"
            describeSuccess={({ response }) =>
                t('admin-billing.reconciliationMarks.action14.refundSuccess', {
                    refundId: response.refundId,
                    status: response.status
                })
            }
        />
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
            setErrorKey(readAction14Rejection({ error }));
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
                    <Action14Field
                        label={t('admin-billing.reconciliationMarks.action14.chargeId')}
                        value={chargeId}
                        onChange={setChargeId}
                    />
                    <Action14Field
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

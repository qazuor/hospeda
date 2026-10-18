/**
 * @file LiftReconciliationMarkAction.tsx
 * Confirmation dialog for administrative action 7 (ACC:7, S15).
 */

import { formatCurrency, type TranslationKey } from '@repo/i18n';
import { PermissionEnum, type ReconciliationMarkListResponseSchema } from '@repo/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { z } from 'zod';
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { useLiftReconciliationMarkMutation } from '../hooks/useLiftReconciliationMark';
import { LIFT_REASON_KEYS, readLiftReason } from '../lift-reasons';

type Mark = z.infer<typeof ReconciliationMarkListResponseSchema>['items'][number];
type Proposal = Mark['defaultProposal'];

const PROPOSALS: Readonly<Record<Proposal, TranslationKey>> = {
    REFUND: 'admin-billing.reconciliationMarks.proposals.refund',
    REFUND_DIFFERENCE: 'admin-billing.reconciliationMarks.proposals.refundDifference',
    NO_REFUND: 'admin-billing.reconciliationMarks.proposals.noRefund',
    NONE: 'admin-billing.reconciliationMarks.proposals.none'
};

/** Props for the lift action of one actionable mark. */
export interface LiftReconciliationMarkActionProps {
    /** Mark and version shown in its article. */
    readonly mark: Mark;
    /** Current locale for the displayed payment amounts. */
    readonly locale: string;
}

/** Renders a permission gated button and explicit action 7 confirmation. */
export function LiftReconciliationMarkAction({ mark, locale }: LiftReconciliationMarkActionProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const mutation = useLiftReconciliationMarkMutation();
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [note, setNote] = useState('');
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const unresolved = mark.payments.filter((payment) => payment.resolvedAt === null);
    const unresolvedLeft = unresolved.some(
        (payment) => !selected.has(`${payment.source}:${payment.paymentId}`)
    );

    const confirm = async () => {
        if (mutation.isPending) return;
        setErrorKey(null);
        const resolveWithoutRefund = unresolved
            .filter((payment) => selected.has(`${payment.source}:${payment.paymentId}`))
            .map(({ source, paymentId }) => ({ source, paymentId }));
        try {
            await mutation.mutateAsync({
                markId: mark.markId,
                expectedVersion: mark.version,
                resolveWithoutRefund,
                ...(note.trim().length > 0 ? { note: note.trim() } : {})
            });
            setOpen(false);
            addToast({
                message: t('admin-billing.reconciliationMarks.lift.success'),
                variant: 'success'
            });
        } catch (error) {
            const reason = readLiftReason({ error });
            setErrorKey(
                reason ? LIFT_REASON_KEYS[reason] : 'admin-billing.reconciliationMarks.lift.error'
            );
            if (reason === 'MARK_VERSION_CONFLICT') {
                await queryClient.invalidateQueries({
                    queryKey: ['billing-reconciliation', 'marks']
                });
            }
        }
    };

    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK]}>
            <AlertDialog
                open={open}
                onOpenChange={(nextOpen) => {
                    setOpen(nextOpen);
                    if (!nextOpen) setErrorKey(null);
                }}
            >
                <Button
                    data-testid="reconciliation-mark-lift"
                    onClick={() => setOpen(true)}
                >
                    {t('admin-billing.reconciliationMarks.lift.button')}
                </Button>
                <AlertDialogContent data-testid="reconciliation-mark-lift-dialog">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('admin-billing.reconciliationMarks.lift.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('admin-billing.reconciliationMarks.lift.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <p>
                        {mark.reasonNumber} · {mark.reason}
                    </p>
                    <p>
                        {t('admin-billing.reconciliationMarks.proposal')}:{' '}
                        {t(PROPOSALS[mark.defaultProposal])}
                    </p>
                    {mark.totalAmount.map((total) => (
                        <p key={total.currency}>
                            {t('admin-billing.reconciliationMarks.total')}:{' '}
                            {formatCurrency({
                                value: total.amountMinor / 100,
                                currency: total.currency,
                                locale
                            })}
                        </p>
                    ))}
                    {unresolved.map((payment) => {
                        const key = `${payment.source}:${payment.paymentId}`;
                        return (
                            <label
                                key={key}
                                className="flex items-start gap-2"
                            >
                                <input
                                    type="checkbox"
                                    data-testid="reconciliation-mark-lift-without-refund"
                                    checked={selected.has(key)}
                                    onChange={(event) =>
                                        setSelected((current) => {
                                            const next = new Set(current);
                                            if (event.target.checked) next.add(key);
                                            else next.delete(key);
                                            return next;
                                        })
                                    }
                                />
                                <span>
                                    {t(
                                        `admin-billing.reconciliationMarks.sources.${payment.source === 'PAYMENT' ? 'card' : 'manual'}`
                                    )}
                                    {' · '}
                                    {payment.amountMinor === null || payment.currency === null
                                        ? t('admin-billing.reconciliationMarks.unknownAmount')
                                        : formatCurrency({
                                              value: payment.amountMinor / 100,
                                              currency: payment.currency,
                                              locale
                                          })}
                                    {' · '}
                                    {payment.paymentId}
                                    {' · '}
                                    {t('admin-billing.reconciliationMarks.lift.withoutRefund')}
                                </span>
                            </label>
                        );
                    })}
                    {unresolvedLeft ? (
                        <p>{t('admin-billing.reconciliationMarks.lift.unresolvedNotice')}</p>
                    ) : null}
                    <label className="grid gap-2">
                        <span>{t('admin-billing.reconciliationMarks.lift.note')}</span>
                        <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                        />
                    </label>
                    {errorKey ? (
                        <p
                            role="alert"
                            data-testid="reconciliation-mark-lift-error"
                        >
                            {t(errorKey)}
                        </p>
                    ) : null}
                    <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                            <Button
                                variant="outline"
                                disabled={mutation.isPending}
                            >
                                {t('admin-billing.reconciliationMarks.lift.cancel')}
                            </Button>
                        </AlertDialogCancel>
                        <Button
                            data-testid="reconciliation-mark-lift-confirm"
                            onClick={() => void confirm()}
                            disabled={mutation.isPending}
                        >
                            {t('admin-billing.reconciliationMarks.lift.confirm')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGate>
    );
}

/**
 * @file ProposedRefundActions.tsx
 * Confirm and decline actions of one proposed refund (administrative action 13, RF2 and RF5).
 */

import type { TranslationKey } from '@repo/i18n';
import type { ProposedRefund } from '@repo/schemas';
import { useRef, useState } from 'react';
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
import { useConfirmRefundMutation, useDeclineRefundMutation } from '../hooks/useRefundDecision';
import {
    CONFIRM_OUTCOME_KEYS,
    readRefundDecisionReason,
    refundDecisionErrorKey
} from '../refund-decision-reasons';

/** Props of the actions of one proposed refund. */
export interface ProposedRefundActionsProps {
    /** The refund as the list returned it. */
    readonly refund: ProposedRefund;
    /** The amount, already formatted for the current locale. */
    readonly amountLabel: string;
}

/**
 * Renders the confirm and decline buttons of one refund, each behind an explicit dialog. Decline
 * stays disabled, with its explanation, for the refund of a held charge: the list says so up
 * front, and a 409 `REFUND_CLOSES_HELD_CHARGE` from the server locks it too.
 */
export function ProposedRefundActions({ refund, amountLabel }: ProposedRefundActionsProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const confirmMutation = useConfirmRefundMutation();
    const declineMutation = useDeclineRefundMutation();
    const [dialog, setDialog] = useState<'confirm' | 'decline' | null>(null);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    // True from the first click until its request settles: two clicks in the same tick, before
    // React re-renders the buttons disabled, must send one POST.
    const submitting = useRef(false);
    const [lockedBy409, setLockedBy409] = useState(false);
    const declineLocked = refund.closesHeldCharge || lockedBy409;
    const canConfirm = refund.status === 'REQUESTED';
    const busy = confirmMutation.isPending || declineMutation.isPending;

    const close = () => {
        setDialog(null);
        setErrorKey(null);
    };

    const confirm = async () => {
        if (submitting.current) return;
        submitting.current = true;
        setErrorKey(null);
        try {
            const result = await confirmMutation.mutateAsync({ refundId: refund.refundId });
            close();
            addToast({
                message:
                    result.outcome === 'SENT'
                        ? t('admin-billing.proposedRefunds.confirm.success')
                        : t(CONFIRM_OUTCOME_KEYS[result.outcome]),
                variant: result.outcome === 'SENT' ? 'success' : 'warning'
            });
        } catch (error) {
            setErrorKey(refundDecisionErrorKey({ error }));
        } finally {
            submitting.current = false;
        }
    };

    const decline = async () => {
        if (submitting.current) return;
        submitting.current = true;
        setErrorKey(null);
        try {
            const result = await declineMutation.mutateAsync({ refundId: refund.refundId });
            close();
            // A declined CONFIRMED refund asks the person to check the provider's panel before
            // settling it by hand, so that warning outlives the dialog as a warning toast.
            addToast(
                result.warning === 'VERIFY_NO_PROVIDER_REFUND'
                    ? {
                          message: t('admin-billing.proposedRefunds.decline.successVerify'),
                          variant: 'warning'
                      }
                    : {
                          message: t('admin-billing.proposedRefunds.decline.success'),
                          variant: 'success'
                      }
            );
        } catch (error) {
            if (readRefundDecisionReason({ error }) === 'REFUND_CLOSES_HELD_CHARGE') {
                setLockedBy409(true);
                close();
                return;
            }
            setErrorKey(refundDecisionErrorKey({ error }));
        } finally {
            submitting.current = false;
        }
    };

    return (
        <div
            className="grid gap-2"
            data-testid="proposed-refund-actions"
        >
            <div className="flex flex-wrap gap-2">
                {canConfirm ? (
                    <Button
                        data-testid="proposed-refund-confirm"
                        disabled={busy}
                        onClick={() => setDialog('confirm')}
                    >
                        {t('admin-billing.proposedRefunds.confirm.button')}
                    </Button>
                ) : null}
                <Button
                    data-testid="proposed-refund-decline"
                    variant="outline"
                    disabled={busy || declineLocked}
                    aria-describedby={
                        declineLocked ? `proposed-refund-locked-${refund.refundId}` : undefined
                    }
                    onClick={() => setDialog('decline')}
                >
                    {t('admin-billing.proposedRefunds.decline.button')}
                </Button>
            </div>
            {canConfirm ? null : (
                <p
                    data-testid="proposed-refund-confirmed-only-decline"
                    className="text-muted-foreground text-sm"
                >
                    {t('admin-billing.proposedRefunds.confirmedOnlyDecline')}
                </p>
            )}
            {declineLocked ? (
                <p
                    id={`proposed-refund-locked-${refund.refundId}`}
                    data-testid="proposed-refund-decline-locked"
                    className="text-muted-foreground text-sm"
                >
                    {t('admin-billing.proposedRefunds.decline.closesHeldCharge')}
                </p>
            ) : null}

            <AlertDialog
                open={dialog === 'confirm'}
                onOpenChange={(open) => {
                    if (!open) close();
                }}
            >
                <AlertDialogContent data-testid="proposed-refund-confirm-dialog">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('admin-billing.proposedRefunds.confirm.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('admin-billing.proposedRefunds.confirm.description', {
                                amount: amountLabel
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {errorKey ? (
                        <p
                            role="alert"
                            data-testid="proposed-refund-error"
                        >
                            {t(errorKey)}
                        </p>
                    ) : null}
                    <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                            <Button
                                variant="outline"
                                disabled={busy}
                            >
                                {t('admin-billing.proposedRefunds.confirm.cancel')}
                            </Button>
                        </AlertDialogCancel>
                        <Button
                            data-testid="proposed-refund-confirm-submit"
                            disabled={busy}
                            onClick={() => void confirm()}
                        >
                            {t('admin-billing.proposedRefunds.confirm.confirm')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={dialog === 'decline'}
                onOpenChange={(open) => {
                    if (!open) close();
                }}
            >
                <AlertDialogContent data-testid="proposed-refund-decline-dialog">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('admin-billing.proposedRefunds.decline.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('admin-billing.proposedRefunds.decline.description', {
                                amount: amountLabel
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {refund.status === 'CONFIRMED' ? (
                        <p
                            role="alert"
                            data-testid="proposed-refund-confirmed-warning"
                            className="font-medium"
                        >
                            {t('admin-billing.proposedRefunds.decline.confirmedWarning')}
                        </p>
                    ) : null}
                    {errorKey ? (
                        <p
                            role="alert"
                            data-testid="proposed-refund-error"
                        >
                            {t(errorKey)}
                        </p>
                    ) : null}
                    <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                            <Button
                                variant="outline"
                                disabled={busy}
                            >
                                {t('admin-billing.proposedRefunds.decline.cancel')}
                            </Button>
                        </AlertDialogCancel>
                        <Button
                            data-testid="proposed-refund-decline-submit"
                            disabled={busy}
                            onClick={() => void decline()}
                        >
                            {t('admin-billing.proposedRefunds.decline.confirm')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

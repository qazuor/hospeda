import type { ApiErrorShape } from '@repo/i18n';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { translateAdminApiError } from '@/lib/errors';
import type { useRefundPaymentMutation } from './hooks';
import type { Payment } from './types';
import { formatArsFromCents, formatDate } from './utils';

/**
 * Props for RefundDialog
 */
export interface RefundDialogProps {
    readonly payment: Payment | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly refundMutation: ReturnType<typeof useRefundPaymentMutation>;
    readonly addToast: ReturnType<typeof useToast>['addToast'];
}

/**
 * Refund dialog component.
 *
 * Supports full and partial refunds with an optional reason. Money moves
 * through the UI in whole-unit ARS (the operator types pesos, not centavos)
 * and is converted to integer centavos ONLY at the mutation boundary — the
 * refund mutation and the backend both speak centavos exclusively.
 */
export function RefundDialog({
    payment,
    open,
    onOpenChange,
    refundMutation,
    addToast
}: RefundDialogProps) {
    const { t, locale } = useTranslations();
    const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
    const [partialAmountArs, setPartialAmountArs] = useState('');
    const [reason, setReason] = useState('');

    if (!payment) return null;

    // Money still outstanding on this payment, in centavos. A prior partial
    // refund reduces the ceiling — the old UI let an operator "refund" up to
    // the ORIGINAL amount even after money had already gone back.
    const outstandingAmountInCents = payment.amountInCents - payment.refundedAmountInCents;

    const refundAmountInCents =
        refundType === 'full'
            ? outstandingAmountInCents
            : Math.round((Number.parseFloat(partialAmountArs) || 0) * 100);

    const handleRefund = () => {
        if (!payment) return;

        refundMutation.mutate(
            {
                id: payment.id,
                amountInCents: refundType === 'partial' ? refundAmountInCents : undefined,
                reason
            },
            {
                onSuccess: () => {
                    addToast({
                        message: t('admin-billing.payments.toasts.refundSuccess'),
                        variant: 'success'
                    });
                    onOpenChange(false);
                    setRefundType('full');
                    setPartialAmountArs('');
                    setReason('');
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.payments.toasts.refundError')} ${translateAdminApiError({ error: error as ApiErrorShape, t })}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.payments.refundDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.payments.refundDialog.description')} {payment.id}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* Payment Info */}
                    <div className="rounded-md border bg-muted p-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">
                                    {payment.user?.displayName ??
                                        t('admin-billing.payments.unknownUser')}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {payment.user?.email ?? ''}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-lg">
                                    {formatArsFromCents(payment.amountInCents, locale)}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {formatDate(payment.createdAt, locale)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Refund Type */}
                    <div className="grid gap-2">
                        <Label>{t('admin-billing.payments.refundDialog.refundTypeLabel')}</Label>
                        <div className="flex gap-4">
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    name="refundType"
                                    value="full"
                                    checked={refundType === 'full'}
                                    onChange={(e) =>
                                        setRefundType(e.target.value as 'full' | 'partial')
                                    }
                                />
                                <span className="text-sm">
                                    {t('admin-billing.payments.refundDialog.fullRefund')}
                                </span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    name="refundType"
                                    value="partial"
                                    checked={refundType === 'partial'}
                                    onChange={(e) =>
                                        setRefundType(e.target.value as 'full' | 'partial')
                                    }
                                />
                                <span className="text-sm">
                                    {t('admin-billing.payments.refundDialog.partialRefund')}
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Partial Amount (whole-unit ARS; converted to centavos on submit) */}
                    {refundType === 'partial' && (
                        <div className="grid gap-2">
                            <Label htmlFor="partialAmount">
                                {t('admin-billing.payments.refundDialog.partialAmountLabel')}
                            </Label>
                            <Input
                                id="partialAmount"
                                type="number"
                                placeholder="0.00"
                                value={partialAmountArs}
                                onChange={(e) => setPartialAmountArs(e.target.value)}
                                min="0"
                                max={outstandingAmountInCents / 100}
                                step="0.01"
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-billing.payments.refundDialog.maxAmount')}{' '}
                                {formatArsFromCents(outstandingAmountInCents, locale)}
                            </p>
                        </div>
                    )}

                    {/* Reason */}
                    <div className="grid gap-2">
                        <Label htmlFor="reason">
                            {t('admin-billing.payments.refundDialog.reasonLabel')}
                        </Label>
                        <textarea
                            id="reason"
                            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder={t('admin-billing.payments.refundDialog.reasonPlaceholder')}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    {/* Summary */}
                    <div className="rounded-md border bg-muted p-3">
                        <div className="flex items-center justify-between font-semibold text-sm">
                            <span>{t('admin-billing.payments.refundDialog.totalToRefund')}</span>
                            <span className="text-lg">
                                {formatArsFromCents(refundAmountInCents, locale)}
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={refundMutation.isPending}
                    >
                        {t('admin-billing.common.cancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleRefund}
                        disabled={
                            refundMutation.isPending ||
                            (refundType === 'partial' &&
                                (!partialAmountArs || refundAmountInCents <= 0)) ||
                            !reason
                        }
                    >
                        {refundMutation.isPending
                            ? t('admin-billing.payments.refundDialog.processingButton')
                            : t('admin-billing.payments.refundDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

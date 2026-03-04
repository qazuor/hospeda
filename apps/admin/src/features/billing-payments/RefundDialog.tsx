import type { useToast } from '@/components/ui/ToastProvider';
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
import { useTranslations } from '@/hooks/use-translations';
import { useState } from 'react';
import type { useRefundPaymentMutation } from './hooks';
import type { Payment } from './types';
import { formatArs, formatDate } from './utils';

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
 * Supports full and partial refunds with an optional reason.
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
    const [partialAmount, setPartialAmount] = useState('');
    const [reason, setReason] = useState('');

    if (!payment) return null;

    const handleRefund = () => {
        if (!payment) return;

        const refundAmount =
            refundType === 'full' ? payment.amount : Number.parseFloat(partialAmount) || 0;

        refundMutation.mutate(
            {
                id: payment.id,
                amount: refundType === 'partial' ? refundAmount : undefined,
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
                    setPartialAmount('');
                    setReason('');
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.payments.toasts.refundError')} ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    const refundAmount =
        refundType === 'full' ? payment.amount : Number.parseFloat(partialAmount) || 0;

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
                                <p className="font-medium text-sm">{payment.userName}</p>
                                <p className="text-muted-foreground text-xs">{payment.userEmail}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-lg">
                                    {formatArs(payment.amount, locale)}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {formatDate(payment.date, locale)}
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

                    {/* Partial Amount */}
                    {refundType === 'partial' && (
                        <div className="grid gap-2">
                            <Label htmlFor="partialAmount">
                                {t('admin-billing.payments.refundDialog.partialAmountLabel')}
                            </Label>
                            <Input
                                id="partialAmount"
                                type="number"
                                placeholder="0.00"
                                value={partialAmount}
                                onChange={(e) => setPartialAmount(e.target.value)}
                                min="0"
                                max={payment.amount}
                                step="0.01"
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-billing.payments.refundDialog.maxAmount')}{' '}
                                {formatArs(payment.amount, locale)}
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
                            <span className="text-lg">{formatArs(refundAmount, locale)}</span>
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
                            (refundType === 'partial' && (!partialAmount || refundAmount <= 0)) ||
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

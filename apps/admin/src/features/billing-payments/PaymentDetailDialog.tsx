import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import type { Payment } from './types';
import { formatArsFromCents, formatDate, getStatusLabel, getStatusVariant } from './utils';

/**
 * Props for PaymentDetailDialog
 */
export interface PaymentDetailDialogProps {
    readonly payment: Payment | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

/**
 * Payment detail dialog component.
 * Displays full payment details including user, payment info, and references.
 */
export function PaymentDetailDialog({ payment, open, onOpenChange }: PaymentDetailDialogProps) {
    const { t, locale } = useTranslations();

    if (!payment) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.payments.dialog.title')}</DialogTitle>
                    <DialogDescription>ID: {payment.id}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* User Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.payments.dialog.userInfo')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            {payment.user ? (
                                <>
                                    <div>
                                        <p className="text-muted-foreground text-xs">
                                            {t('admin-billing.payments.dialog.nameLabel')}
                                        </p>
                                        <p className="font-medium">{payment.user.displayName}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">
                                            {t('admin-billing.payments.dialog.emailLabel')}
                                        </p>
                                        <p className="font-medium">{payment.user.email}</p>
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2 text-muted-foreground italic">
                                    {t('admin-billing.payments.unknownUser')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.payments.dialog.paymentInfo')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.amountLabel')}
                                </p>
                                <p className="font-semibold text-lg">
                                    {formatArsFromCents(payment.amountInCents, locale)}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.statusLabel')}
                                </p>
                                <Badge variant={getStatusVariant(payment.status)}>
                                    {getStatusLabel(payment.status, t)}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.dateLabel')}
                                </p>
                                <p className="font-medium">
                                    {formatDate(payment.createdAt, locale)}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.providerLabel')}
                                </p>
                                <p className="font-medium">
                                    {payment.provider ?? t('admin-billing.common.noData')}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.planLabel')}
                                </p>
                                <p className="font-medium">
                                    {payment.plan?.displayName ??
                                        t('admin-billing.payments.unknownPlan')}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.transactionIdLabel')}
                                </p>
                                <p className="font-mono text-xs">
                                    {payment.providerPaymentId ?? t('admin-billing.common.noData')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Related Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.payments.dialog.references')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.subscriptionLabel')}
                                </p>
                                <p className="font-mono text-xs">
                                    {payment.subscriptionId ?? t('admin-billing.common.noData')}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.invoiceLabel')}
                                </p>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 font-mono text-xs"
                                    disabled
                                >
                                    {payment.invoiceId ?? t('admin-billing.common.noData')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('admin-billing.common.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

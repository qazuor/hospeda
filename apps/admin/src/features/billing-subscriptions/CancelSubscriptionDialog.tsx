import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { useState } from 'react';
import type { Subscription } from './types';
import { formatDate } from './utils';

/**
 * Props for CancelSubscriptionDialog
 */
export interface CancelSubscriptionDialogProps {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (reason?: string) => void;
}

/**
 * Cancel confirmation dialog component.
 *
 * The backend's admin cancel endpoint only supports end-of-period
 * cancellation today; the immediate-cancel toggle that used to live
 * here was removed in the billing UI audit (see docs/billing/
 * ui-audit-2026.md) until the API supports `immediate`.
 */
export function CancelSubscriptionDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: CancelSubscriptionDialogProps) {
    const { t, locale } = useTranslations();
    const [cancelReason, setCancelReason] = useState('');

    const handleConfirm = () => {
        onConfirm(cancelReason || undefined);
        setCancelReason('');
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.subscriptions.cancelDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.cancelDialog.description')}{' '}
                        {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-md border border-input bg-muted/30 p-3 text-sm">
                        <Label className="font-medium">
                            {t('admin-billing.subscriptions.cancelDialog.timingLabel')}
                        </Label>
                        <p className="mt-1 text-muted-foreground">
                            {t('admin-billing.subscriptions.cancelDialog.endOfPeriod')} (
                            {formatDate(subscription.currentPeriodEnd, locale)})
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cancel-reason">
                            {t('admin-billing.subscriptions.cancelDialog.reasonLabel')}
                        </Label>
                        <select
                            id="cancel-reason"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        >
                            <option value="">
                                {t('admin-billing.subscriptions.cancelDialog.reasonPlaceholder')}
                            </option>
                            <option value="too_expensive">
                                {t('admin-billing.subscriptions.cancelDialog.reasons.tooExpensive')}
                            </option>
                            <option value="missing_features">
                                {t(
                                    'admin-billing.subscriptions.cancelDialog.reasons.missingFeatures'
                                )}
                            </option>
                            <option value="technical_issues">
                                {t(
                                    'admin-billing.subscriptions.cancelDialog.reasons.technicalIssues'
                                )}
                            </option>
                            <option value="switching_competitor">
                                {t(
                                    'admin-billing.subscriptions.cancelDialog.reasons.switchingCompetitor'
                                )}
                            </option>
                            <option value="business_closed">
                                {t(
                                    'admin-billing.subscriptions.cancelDialog.reasons.businessClosed'
                                )}
                            </option>
                            <option value="other">
                                {t('admin-billing.subscriptions.cancelDialog.reasons.other')}
                            </option>
                        </select>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.subscriptions.cancelDialog.backButton')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                    >
                        {t('admin-billing.subscriptions.cancelDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

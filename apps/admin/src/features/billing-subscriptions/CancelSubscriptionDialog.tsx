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
    readonly onConfirm: (immediate: boolean, reason?: string) => void;
}

/**
 * Cancel confirmation dialog component.
 * Allows admins to cancel a subscription at period end or immediately,
 * with an optional cancellation reason.
 */
export function CancelSubscriptionDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: CancelSubscriptionDialogProps) {
    const { t, locale } = useTranslations();
    const [cancelImmediate, setCancelImmediate] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const handleConfirm = () => {
        onConfirm(cancelImmediate, cancelReason || undefined);
        setCancelReason('');
        setCancelImmediate(false);
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
                    <div className="space-y-2">
                        <Label htmlFor="cancel-timing">
                            {t('admin-billing.subscriptions.cancelDialog.timingLabel')}
                        </Label>
                        <select
                            id="cancel-timing"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={cancelImmediate ? 'immediate' : 'end_of_period'}
                            onChange={(e) => setCancelImmediate(e.target.value === 'immediate')}
                        >
                            <option value="end_of_period">
                                {t('admin-billing.subscriptions.cancelDialog.endOfPeriod')} (
                                {formatDate(subscription.currentPeriodEnd, locale)})
                            </option>
                            <option value="immediate">
                                {t('admin-billing.subscriptions.cancelDialog.immediate')}
                            </option>
                        </select>
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

                    {cancelImmediate && (
                        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                            <p className="text-destructive text-sm">
                                {t('admin-billing.subscriptions.cancelDialog.immediateWarning')}
                            </p>
                        </div>
                    )}
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

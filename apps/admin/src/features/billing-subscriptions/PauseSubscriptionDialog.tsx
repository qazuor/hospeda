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

/**
 * Props for PauseSubscriptionDialog
 */
export interface PauseSubscriptionDialogProps {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (suspendService: boolean) => void;
}

/**
 * Pause confirmation dialog component (SPEC-143 #29).
 *
 * Lets the admin choose between a "full" pause (billing hold + service
 * suspension: the owner's accommodations are hidden from public reads and
 * edit-locked) and a billing-only hold (listings stay live). Honored by the
 * qzpay-hono admin endpoint `POST /admin/billing/subscriptions/:id/pause`,
 * which reads `suspendService` from the body (defaults to true).
 */
export function PauseSubscriptionDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: PauseSubscriptionDialogProps) {
    const { t } = useTranslations();
    const [suspendService, setSuspendService] = useState(true);

    const handleConfirm = () => {
        onConfirm(suspendService);
        setSuspendService(true);
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.subscriptions.pauseDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.pauseDialog.description')}{' '}
                        {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="pause-scope">
                            {t('admin-billing.subscriptions.pauseDialog.scopeLabel')}
                        </Label>
                        <select
                            id="pause-scope"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={suspendService ? 'full' : 'billing_only'}
                            onChange={(e) => setSuspendService(e.target.value === 'full')}
                        >
                            <option value="full">
                                {t('admin-billing.subscriptions.pauseDialog.scopeFull')}
                            </option>
                            <option value="billing_only">
                                {t('admin-billing.subscriptions.pauseDialog.scopeBillingOnly')}
                            </option>
                        </select>
                    </div>

                    {suspendService && (
                        <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
                            <p className="text-sm">
                                {t('admin-billing.subscriptions.pauseDialog.fullWarning')}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.subscriptions.pauseDialog.backButton')}
                    </Button>
                    <Button onClick={handleConfirm}>
                        {t('admin-billing.subscriptions.pauseDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

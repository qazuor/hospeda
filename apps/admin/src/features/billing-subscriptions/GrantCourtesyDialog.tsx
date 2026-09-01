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
import { useTranslations } from '@/hooks/use-translations';
import type { Subscription } from './types';

/** Props for GrantCourtesyDialog */
export interface GrantCourtesyDialogProps {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (cycles: number) => void;
}

/**
 * Courtesy grant dialog (HOS-180).
 *
 * Gifts N free billing cycles to a subscriber who is already paying. The
 * subscriber keeps every entitlement, is never asked for their card again, and
 * returns to full price on their own when the gift ends.
 *
 * Two things the admin needs to understand before confirming, and the dialog
 * says both rather than assuming:
 *
 * 1. **The gift starts at the end of the period they already paid for**, not
 *    today. Nothing changes for them this month, because they already paid for
 *    this month.
 * 2. **It can be refused for being too late.** Pausing the MercadoPago
 *    preapproval is what stops the next charge, so a grant made under three days
 *    before the due date may lose that race — and the subscriber would be
 *    charged for exactly the cycle being gifted. The endpoint returns a 422
 *    naming the next charge date; surface it as-is.
 */
export function GrantCourtesyDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: GrantCourtesyDialogProps) {
    const { t } = useTranslations();
    const [cycles, setCycles] = useState(1);

    const handleConfirm = () => {
        onConfirm(cycles);
        setCycles(1);
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.subscriptions.courtesyDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.courtesyDialog.description')}{' '}
                        {subscription.user?.displayName ??
                            t('admin-billing.subscriptions.unknownUser')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="courtesy-cycles">
                            {t('admin-billing.subscriptions.courtesyDialog.cyclesLabel')}
                        </Label>
                        <Input
                            id="courtesy-cycles"
                            type="number"
                            min={1}
                            step={1}
                            value={cycles}
                            onChange={(e) => setCycles(Math.max(1, Number(e.target.value) || 1))}
                        />
                    </div>

                    <div className="rounded-md border border-info/30 bg-info/10 p-3">
                        <p className="text-sm">
                            {t('admin-billing.subscriptions.courtesyDialog.startsAtNotice')}
                        </p>
                    </div>

                    <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
                        <p className="text-sm">
                            {t('admin-billing.subscriptions.courtesyDialog.leadTimeWarning')}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.subscriptions.courtesyDialog.backButton')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={cycles < 1}
                    >
                        {t('admin-billing.subscriptions.courtesyDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

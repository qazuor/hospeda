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
import { LoaderIcon } from '@repo/icons';
import { useState } from 'react';
import type { Subscription } from './types';
import { formatDate } from './utils';

/**
 * Props for ExtendTrialDialog
 */
export interface ExtendTrialDialogProps {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (additionalDays: number) => void;
    readonly isPending: boolean;
}

/**
 * Extend trial dialog component.
 * Allows admins to extend a trialing subscription by a configurable number of days (1-90).
 */
export function ExtendTrialDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm,
    isPending
}: ExtendTrialDialogProps) {
    const { t, locale } = useTranslations();
    const [additionalDays, setAdditionalDays] = useState(7);

    const currentTrialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;
    const newTrialEnd = currentTrialEnd
        ? new Date(currentTrialEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000)
        : null;

    const handleConfirm = () => {
        onConfirm(additionalDays);
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.subscriptions.extendTrialDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.extendTrialDialog.description')}{' '}
                        {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="extend-days">
                            {t('admin-billing.subscriptions.extendTrialDialog.daysLabel')}
                        </Label>
                        <Input
                            id="extend-days"
                            type="number"
                            min={1}
                            max={90}
                            value={additionalDays}
                            onChange={(e) => setAdditionalDays(Number(e.target.value))}
                        />
                        <p className="text-muted-foreground text-xs">
                            {t('admin-billing.subscriptions.extendTrialDialog.daysHint')}
                        </p>
                    </div>

                    <div className="rounded-md border bg-muted p-3">
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.subscriptions.extendTrialDialog.currentEnd')}
                                </span>
                                <span>
                                    {currentTrialEnd
                                        ? formatDate(currentTrialEnd.toISOString(), locale)
                                        : t('admin-common.states.notAvailable')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.subscriptions.extendTrialDialog.newEnd')}
                                </span>
                                <span className="font-medium">
                                    {newTrialEnd
                                        ? formatDate(newTrialEnd.toISOString(), locale)
                                        : t('admin-common.states.notAvailable')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        {t('admin-billing.common.cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={additionalDays < 1 || additionalDays > 90 || isPending}
                    >
                        {isPending && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                        {t('admin-billing.subscriptions.extendTrialDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
import type { Subscription } from './types';

/**
 * Props for ResumeSubscriptionDialog
 */
export interface ResumeSubscriptionDialogProps {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: () => void;
}

/**
 * Resume confirmation dialog component (SPEC-143 #29).
 *
 * Resume always reverts both dimensions of the pause: billing restarts and any
 * service suspension is cleared (the owner's accommodations come back exactly
 * as they were). Honored by `POST /admin/billing/subscriptions/:id/resume`.
 */
export function ResumeSubscriptionDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: ResumeSubscriptionDialogProps) {
    const { t } = useTranslations();

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.subscriptions.resumeDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.resumeDialog.description')}{' '}
                        {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.subscriptions.resumeDialog.backButton')}
                    </Button>
                    <Button onClick={onConfirm}>
                        {t('admin-billing.subscriptions.resumeDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Promo Code Delete Confirmation Dialog
 *
 * Confirmation dialog for deleting a promo code.
 */
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { PromoCode } from '@/features/promo-codes';
import { useTranslations } from '@/hooks/use-translations';

interface PromoCodeDeleteDialogProps {
    readonly promoCode: PromoCode | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: () => void;
}

/**
 * Delete Confirmation Dialog for promo codes
 */
export function PromoCodeDeleteDialog({
    promoCode,
    isOpen,
    onClose,
    onConfirm
}: PromoCodeDeleteDialogProps) {
    const { t } = useTranslations();
    if (!promoCode) return null;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.promoCodes.deleteDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.promoCodes.deleteDialog.description')}{' '}
                        <code className="font-bold font-mono">{promoCode.code}</code>?
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                    <p className="text-destructive text-sm">
                        ⚠️ {t('admin-billing.promoCodes.deleteDialog.warning')}
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.promoCodes.deleteDialog.cancelButton')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        {t('admin-billing.promoCodes.deleteDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

import type { TranslationKey } from '@repo/i18n';
import type { AdminPromoCode } from '@repo/schemas';
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
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { adminLogger } from '@/utils/logger';
import { useClosePromoCodeMutation } from '../hooks/usePromoCodes';
import { promoCodeRejectionLabel } from '../promo-code-draft';

/** Confirmation dialog for closing one code without changing existing redemptions. */
export function PromoCodeCloseDialog({
    promoCode,
    onOpenChange
}: {
    readonly promoCode: AdminPromoCode | null;
    readonly onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useClosePromoCodeMutation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const key = (value: string) => t(value as TranslationKey);

    const closeCode = async () => {
        if (!promoCode || mutation.isPending) return;
        setErrorMessage(null);
        try {
            await mutation.mutateAsync({ promoCodeId: promoCode.id });
            addToast({
                title: key('admin-billing.promoCodes.editor.toasts.closed'),
                message: key('admin-billing.promoCodes.editor.toasts.closed'),
                variant: 'success'
            });
            onOpenChange(false);
        } catch (error) {
            adminLogger.error('[PromoCodeCloseDialog] Failed to close a promo code', {
                promoCodeId: promoCode.id,
                error
            });
            const reason = isApiError(error)
                ? (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason
                : undefined;
            setErrorMessage(
                reason
                    ? promoCodeRejectionLabel({ reason, t: key })
                    : key('admin-billing.promoCodes.editor.toasts.closeError')
            );
        }
    };

    return (
        <Dialog
            open={promoCode !== null}
            onOpenChange={onOpenChange}
        >
            <DialogContent data-testid="promo-code-close-confirmation">
                <DialogHeader>
                    <DialogTitle>{key('admin-billing.promoCodes.editor.closeTitle')}</DialogTitle>
                    <DialogDescription>
                        {key('admin-billing.promoCodes.editor.closeNow').replace(
                            '{{code}}',
                            promoCode?.code ?? ''
                        )}
                    </DialogDescription>
                </DialogHeader>
                {promoCode ? (
                    <p>
                        {key('admin-billing.promoCodes.editor.closeRedemptions').replace(
                            '{{count}}',
                            String(promoCode.redemptionCount)
                        )}
                    </p>
                ) : null}
                {errorMessage ? <p role="alert">{errorMessage}</p> : null}
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {key('admin-billing.promoCodes.editor.cancel')}
                    </Button>
                    <Button
                        disabled={mutation.isPending || promoCode === null}
                        onClick={() => void closeCode()}
                    >
                        {key('admin-billing.promoCodes.editor.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

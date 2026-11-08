import { Button } from '@/components/ui/button';
import { formatCancellationDate } from '@/features/billing-cancellation/cancellation-format';
import { useTranslations } from '@/hooks/use-translations';
import type { CourtesyRevokePreview } from '../hooks/useTemporaryCourtesy';

/** Explicit S10 loss, no-refund and charge effects shown before revocation. */
export function CourtesyRevokeConfirmation({
    preview,
    customer,
    pending,
    onConfirm
}: {
    readonly preview: CourtesyRevokePreview;
    readonly customer: string;
    readonly pending: boolean;
    readonly onConfirm: () => void;
}) {
    const { t, locale } = useTranslations();
    if (!preview.courtesy || !preview.predictedNextChargeAt) return null;
    const date = (iso: string) => formatCancellationDate({ iso, locale });
    return (
        <div
            data-testid="courtesy-revoke-confirmation"
            className="space-y-3"
        >
            <p>
                {t('admin-billing.temporaryCourtesy.revokeConfirm', {
                    customer,
                    remaining: preview.courtesy.remainingMonths,
                    endsAt: date(preview.courtesy.endsAt),
                    date: date(preview.predictedNextChargeAt)
                })}
            </p>
            <Button
                type="button"
                disabled={pending}
                onClick={onConfirm}
            >
                {t('admin-billing.temporaryCourtesy.confirm')}
            </Button>
        </div>
    );
}

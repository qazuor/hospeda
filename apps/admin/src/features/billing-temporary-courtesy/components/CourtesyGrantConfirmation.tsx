import { Button } from '@/components/ui/button';
import { formatCancellationDate } from '@/features/billing-cancellation/cancellation-format';
import { useTranslations } from '@/hooks/use-translations';
import type { CourtesyGrantPreview } from '../hooks/useTemporaryCourtesy';

/** Explicit S9/S34 effects shown before a grant. */
export function CourtesyGrantConfirmation({
    preview,
    customer,
    pending,
    onConfirm
}: {
    readonly preview: CourtesyGrantPreview;
    readonly customer: string;
    readonly pending: boolean;
    readonly onConfirm: () => void;
}) {
    const { t, tPlural, locale } = useTranslations();
    const date = (iso: string) => formatCancellationDate({ iso, locale });
    return (
        <div
            data-testid="courtesy-grant-confirmation"
            className="space-y-3"
        >
            <p>
                {preview.liveCourtesy
                    ? tPlural('admin-billing.temporaryCourtesy.extendConfirm', preview.months, {
                          customer,
                          current: date(preview.liveCourtesy.endsAt),
                          date: date(preview.endsAt)
                      })
                    : tPlural('admin-billing.temporaryCourtesy.grantConfirm', preview.months, {
                          customer,
                          date: date(preview.endsAt)
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

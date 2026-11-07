import type {
    PermanentGrantRevocationPreviewResponse,
    PermanentGrantRevocationResponse
} from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRevocationDay } from '@/features/billing-revocation/revocation-format';
import { useTranslations } from '@/hooks/use-translations';
import { usePermanentGrantRevocation } from '../hooks/usePermanentGrants';
import { GrantRefusal } from './GrantRefusal';

interface Props {
    preview: PermanentGrantRevocationPreviewResponse;
    userId: string;
    onBack: () => void;
    onCompleted: (result: PermanentGrantRevocationResponse) => void;
}

export function PermanentGrantRevocationConfirmation({
    preview,
    userId,
    onBack,
    onCompleted
}: Props) {
    const { t } = useTranslations();
    const [reason, setReason] = useState('');
    const [error, setError] = useState<unknown>(null);
    const mutation = usePermanentGrantRevocation();
    const submit = async () => {
        if (reason.trim().length === 0 || mutation.isPending) return;
        setError(null);
        try {
            const result = await mutation.mutateAsync({
                permanentGrantId: preview.permanentGrantId,
                userId,
                reason: reason.trim()
            });
            onCompleted(result);
        } catch (failure) {
            setError(failure);
        }
    };
    return (
        <div
            className="space-y-4"
            data-testid="permanent-grant-revocation-confirmation"
        >
            <h3 className="font-semibold">{t('admin-billing.permanentGrants.revocationTitle')}</h3>
            <section data-testid="permanent-grant-verticals-losing-service">
                {preview.verticalsLosingService.length === 0 ? (
                    <p>{t('admin-billing.permanentGrants.noneLosingService')}</p>
                ) : (
                    preview.verticalsLosingService.map((vertical) => (
                        <p key={vertical}>
                            {t('admin-billing.permanentGrants.losingService', {
                                vertical: t(
                                    `admin-billing.permanentGrants.verticals.${vertical}` as 'admin-billing.permanentGrants.verticals.accommodation'
                                )
                            })}
                        </p>
                    ))
                )}
            </section>
            <section data-testid="permanent-grant-addons-turned-off">
                <h4>{t('admin-billing.permanentGrants.addonsOff')}</h4>
                {preview.addonsTurnedOff.length === 0 ? (
                    <p>{t('admin-billing.permanentGrants.noneAddonsOff')}</p>
                ) : (
                    preview.addonsTurnedOff.map((addon) => (
                        <p key={addon.addonInstanceId}>
                            {t('admin-billing.permanentGrants.addonOff', { name: addon.addonName })}
                        </p>
                    ))
                )}
            </section>
            <p>{t('admin-billing.permanentGrants.trialNoReturn')}</p>
            <p>{t('admin-billing.permanentGrants.oldDebitNoResume')}</p>
            <div className="space-y-2">
                <Label htmlFor="permanent-grant-revocation-reason">
                    {t('admin-billing.permanentGrants.revocationReason')}
                </Label>
                <Textarea
                    id="permanent-grant-revocation-reason"
                    value={reason}
                    maxLength={2000}
                    onChange={(event) => setReason(event.target.value)}
                    data-testid="permanent-grant-revocation-reason"
                />
            </div>
            {error ? <GrantRefusal error={error} /> : null}
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="destructive"
                    disabled={reason.trim().length === 0 || mutation.isPending}
                    onClick={submit}
                    data-testid="permanent-grant-revocation-submit"
                >
                    {t('admin-billing.permanentGrants.confirmRevoke')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                >
                    {t('admin-billing.permanentGrants.cancel')}
                </Button>
            </div>
        </div>
    );
}

export function PermanentGrantRevocationResult({
    result
}: {
    result: PermanentGrantRevocationResponse;
}) {
    const { t, locale } = useTranslations();
    return (
        <p data-testid="permanent-grant-result">
            {t('admin-billing.permanentGrants.resultRevoke', {
                date: formatRevocationDay({ iso: result.revokedAt, locale })
            })}
        </p>
    );
}

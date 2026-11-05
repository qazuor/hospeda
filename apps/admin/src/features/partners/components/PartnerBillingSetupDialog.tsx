import type { TranslationKey } from '@repo/i18n';
import type { PartnerBillingSetupOptionSchema } from '@repo/schemas';
import { useState } from 'react';
import type { z } from 'zod';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { ApiError } from '@/lib/errors';
import {
    usePartnerBillingSetupMutation,
    usePartnerBillingSetupPreview
} from '../hooks/usePartnerBillingSetup';

type BillingOption = z.infer<typeof PartnerBillingSetupOptionSchema>;

/** Props for {@link PartnerBillingSetupDialog}. AC:V7:17; ACC:6. */
export interface PartnerBillingSetupDialogProps {
    /** Partner UUID. AC:V7:17; ACC:6. */
    readonly partnerId: string;
    /** Controls the preview query and dialog visibility. AC:V7:17; ACC:6. */
    readonly open: boolean;
    /** Called when the dialog visibility changes. AC:V7:17; ACC:6. */
    readonly onOpenChange: (open: boolean) => void;
}

/** Requires review before sending the action 6 write request. AC:V7:17; ACC:6. */
export function PartnerBillingSetupDialog({
    partnerId,
    open,
    onOpenChange
}: PartnerBillingSetupDialogProps) {
    const { t, locale } = useTranslations();
    const preview = usePartnerBillingSetupPreview(partnerId, open);
    const mutation = usePartnerBillingSetupMutation(partnerId);
    const [optionId, setOptionId] = useState('');
    const [reason, setReason] = useState('');
    const [reviewing, setReviewing] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const option = preview.data?.options.find((item) => item.billingOptionId === optionId);
    const messageFor = (error: unknown): TranslationKey => {
        if (!(error instanceof ApiError))
            return 'admin-entities.partnerBillingSetup.errors.generic';
        if (error.status === 403) return 'admin-entities.partnerBillingSetup.errors.forbidden';
        const body = error.body as { error?: { code?: string } } | undefined;
        const code = body?.error?.code;
        if (error.status === 409 && code === 'PARTNER_WITHOUT_OWNER')
            return 'admin-entities.partnerBillingSetup.errors.partnerWithoutOwner';
        if (error.status === 409)
            return 'admin-entities.partnerBillingSetup.errors.commitmentTaken';
        if (error.status === 422) return 'admin-entities.partnerBillingSetup.errors.planNotForSale';
        return 'admin-entities.partnerBillingSetup.errors.generic';
    };
    const money = (item: BillingOption) =>
        new Intl.NumberFormat(locale, { style: 'currency', currency: item.currency }).format(
            item.amountMinor / 100
        );
    const confirm = async () => {
        if (!option || !reason.trim()) return;
        setErrorKey(null);
        try {
            await mutation.mutateAsync({
                billingOptionId: option.billingOptionId,
                reason: reason.trim(),
                confirm: true
            });
            setReviewing(false);
            setOptionId('');
            setReason('');
            onOpenChange(false);
        } catch (error) {
            setErrorKey(messageFor(error));
            setReviewing(false);
        }
    };
    const cycleKey = (cycle: BillingOption['cycle']) =>
        `admin-entities.partnerBillingSetup.cycle.${cycle}` as TranslationKey;
    return (
        <AlertDialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <AlertDialogContent data-testid="partner-billing-setup-dialog">
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t('admin-entities.partnerBillingSetup.configure')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin-entities.partnerBillingSetup.state')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {reviewing && preview.data && option ? (
                    <div
                        className="space-y-2 rounded-md border p-3"
                        data-testid="partner-billing-setup-confirmation"
                    >
                        <p>{t('admin-entities.partnerBillingSetup.confirmationTitle')}</p>
                        <p>
                            {t('admin-entities.partnerBillingSetup.partner')}:{' '}
                            {preview.data.partner.name}
                        </p>
                        <p>
                            {t('admin-entities.partnerBillingSetup.owner')}:{' '}
                            {preview.data.ownerUserId}
                        </p>
                        <p>
                            {t('admin-entities.partnerBillingSetup.planLabel')}: {option.planName} ·{' '}
                            {t(cycleKey(option.cycle))}
                        </p>
                        <p>
                            {t('admin-entities.partnerBillingSetup.amount')}: {money(option)}
                        </p>
                        <p>
                            {t('admin-entities.partnerBillingSetup.method')}:{' '}
                            {t('admin-entities.partnerBillingSetup.manual')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {preview.isLoading ? (
                            <p>{t('admin-entities.partnerBillingSetup.loading')}</p>
                        ) : null}
                        {preview.isError ? (
                            <p role="alert">
                                {t('admin-entities.partnerBillingSetup.previewError')}
                            </p>
                        ) : null}
                        <fieldset className="space-y-2">
                            <legend className="font-medium">
                                {t('admin-entities.partnerBillingSetup.planLabel')}
                            </legend>
                            {preview.data?.options.map((item) => (
                                <label
                                    key={item.billingOptionId}
                                    className="flex items-center gap-2 rounded-md border p-2"
                                >
                                    <input
                                        type="radio"
                                        name="partner-billing-option"
                                        value={item.billingOptionId}
                                        checked={optionId === item.billingOptionId}
                                        onChange={() => setOptionId(item.billingOptionId)}
                                    />
                                    <span>
                                        {item.planName} · {t(cycleKey(item.cycle))} · {money(item)}
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                        <div className="space-y-2">
                            <Label htmlFor="partner-billing-setup-reason">
                                {t('admin-entities.partnerBillingSetup.reasonLabel')}
                            </Label>
                            <Textarea
                                id="partner-billing-setup-reason"
                                maxLength={500}
                                value={reason}
                                onChange={(event) => setReason(event.target.value.slice(0, 500))}
                            />
                        </div>
                    </div>
                )}
                {errorKey ? <p role="alert">{t(errorKey)}</p> : null}
                <AlertDialogFooter>
                    <AlertDialogCancel>
                        {t('admin-entities.partnerBillingSetup.cancel')}
                    </AlertDialogCancel>
                    {reviewing ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setReviewing(false)}
                            >
                                {t('admin-entities.partnerBillingSetup.back')}
                            </Button>
                            <Button
                                disabled={mutation.isPending}
                                onClick={() => void confirm()}
                            >
                                {t('admin-entities.partnerBillingSetup.confirm')}
                            </Button>
                        </>
                    ) : (
                        <Button
                            disabled={!option || !reason.trim() || preview.isLoading}
                            onClick={() => {
                                setErrorKey(null);
                                setReviewing(true);
                            }}
                        >
                            {t('admin-entities.partnerBillingSetup.review')}
                        </Button>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

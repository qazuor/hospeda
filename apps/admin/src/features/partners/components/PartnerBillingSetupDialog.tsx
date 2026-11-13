import type { TranslationKey } from '@repo/i18n';
import { useState } from 'react';
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
import {
    partnerBillingSetupErrorKey,
    usePartnerBillingSetupMutation,
    usePartnerBillingSetupPreview
} from '../hooks/usePartnerBillingSetup';
import {
    PartnerBillingSetupConfirmation,
    PartnerBillingSetupOptionList
} from './PartnerBillingSetupCard';

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
    const { t } = useTranslations();
    const preview = usePartnerBillingSetupPreview(partnerId, open);
    const mutation = usePartnerBillingSetupMutation(partnerId);
    const [optionId, setOptionId] = useState('');
    const [reason, setReason] = useState('');
    const [reviewing, setReviewing] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const option = preview.data?.options.find((item) => item.billingOptionId === optionId);
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
            setErrorKey(partnerBillingSetupErrorKey(error));
            setReviewing(false);
        }
    };
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
                    <PartnerBillingSetupConfirmation
                        preview={preview.data}
                        option={option}
                    />
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
                        <PartnerBillingSetupOptionList
                            options={preview.data?.options ?? []}
                            selectedId={optionId}
                            onSelect={setOptionId}
                        />
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

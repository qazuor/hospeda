import type { TranslationKey } from '@repo/i18n';
import type { PlanPaymentMethod } from '@repo/schemas';
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
    const [chosenMethod, setChosenMethod] = useState<PlanPaymentMethod | ''>('');
    const [reviewing, setReviewing] = useState(false);
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const option = preview.data?.options.find((item) => item.billingOptionId === optionId);
    // HOS-2196: the plan declares the methods; a single one needs no choice.
    const accepted = option?.paymentMethods ?? [];
    const method: PlanPaymentMethod | '' =
        accepted.length === 1
            ? (accepted[0] ?? '')
            : chosenMethod && accepted.includes(chosenMethod)
              ? chosenMethod
              : '';
    const close = (next: boolean) => {
        if (!next) {
            setCheckoutUrl(null);
            setCopied(false);
        }
        onOpenChange(next);
    };
    const copyLink = async () => {
        if (!checkoutUrl) return;
        try {
            await navigator.clipboard.writeText(checkoutUrl);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };
    const confirm = async () => {
        if (!option || !method || !reason.trim()) return;
        setErrorKey(null);
        try {
            const result = await mutation.mutateAsync({
                billingOptionId: option.billingOptionId,
                paymentMethod: method,
                reason: reason.trim(),
                confirm: true
            });
            setReviewing(false);
            setOptionId('');
            setChosenMethod('');
            setReason('');
            if (result.checkoutUrl) {
                setCheckoutUrl(result.checkoutUrl);
                return;
            }
            onOpenChange(false);
        } catch (error) {
            setErrorKey(partnerBillingSetupErrorKey(error));
            setReviewing(false);
        }
    };
    return (
        <AlertDialog
            open={open}
            onOpenChange={close}
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
                {checkoutUrl ? (
                    <div
                        className="space-y-2 rounded-md border p-3"
                        data-testid="partner-billing-setup-link"
                    >
                        <p className="font-medium">
                            {t('admin-entities.partnerBillingSetup.linkTitle')}
                        </p>
                        <p>{t('admin-entities.partnerBillingSetup.linkHelp')}</p>
                        <input
                            readOnly
                            aria-label={t('admin-entities.partnerBillingSetup.linkTitle')}
                            className="w-full rounded-md border p-2 text-sm"
                            value={checkoutUrl}
                            onFocus={(event) => event.currentTarget.select()}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void copyLink()}
                        >
                            {t(
                                copied
                                    ? 'admin-entities.partnerBillingSetup.copied'
                                    : 'admin-entities.partnerBillingSetup.copy'
                            )}
                        </Button>
                    </div>
                ) : reviewing && preview.data && option && method ? (
                    <PartnerBillingSetupConfirmation
                        preview={preview.data}
                        option={option}
                        method={method}
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
                        {accepted.length > 1 ? (
                            <fieldset className="space-y-2">
                                <legend className="font-medium">
                                    {t('admin-entities.partnerBillingSetup.methodChoice')}
                                </legend>
                                {accepted.map((item) => (
                                    <label
                                        key={item}
                                        className="flex items-center gap-2 rounded-md border p-2"
                                    >
                                        <input
                                            type="radio"
                                            name="partner-billing-method"
                                            value={item}
                                            checked={method === item}
                                            onChange={() => setChosenMethod(item)}
                                        />
                                        <span>
                                            {t(
                                                item === 'CARD'
                                                    ? 'admin-entities.partnerBillingSetup.card'
                                                    : 'admin-entities.partnerBillingSetup.manual'
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </fieldset>
                        ) : null}
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
                        {t(
                            checkoutUrl
                                ? 'admin-entities.partnerBillingSetup.close'
                                : 'admin-entities.partnerBillingSetup.cancel'
                        )}
                    </AlertDialogCancel>
                    {checkoutUrl ? null : reviewing ? (
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
                            disabled={!option || !method || !reason.trim() || preview.isLoading}
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

import { AdminSubscriptionPlanChangeParamsSchema, PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCancellationDate } from '@/features/billing-cancellation/cancellation-format';
import { useTranslations } from '@/hooks/use-translations';
import {
    useBillingPlanChangeAction,
    useBillingPlanChangeData
} from '../hooks/useBillingPlanChange';

export function BillingPlanChangeScreen({ subscriptionId }: { readonly subscriptionId: string }) {
    const { t, locale } = useTranslations();
    const validId = AdminSubscriptionPlanChangeParamsSchema.safeParse({ subscriptionId }).success;
    const data = useBillingPlanChangeData(subscriptionId, validId);
    const action = useBillingPlanChangeAction();
    const [selectedId, setSelectedId] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [note, setNote] = useState('');
    const [error, setError] = useState(false);
    const [copied, setCopied] = useState(false);
    const date = (iso: string) => formatCancellationDate({ iso, locale });
    const options = data.data?.options.options.filter((option) => !option.current) ?? [];
    const selected = options.find((option) => option.billingOptionId === selectedId);
    const inspection = data.data?.inspection;
    const customer =
        inspection?.subject?.displayName ||
        inspection?.subject?.email ||
        inspection?.subject?.id ||
        subscriptionId;
    const current =
        inspection?.currentPlan?.planName ??
        data.data?.options.options.find((option) => option.current)?.planName ??
        '—';
    const result = action.data;
    const submit = async () => {
        if (!selected || inspection?.status !== 'ACTIVE' || action.isPending) return;
        try {
            setError(false);
            await action.mutateAsync({
                subscriptionId,
                billingOptionId: selected.billingOptionId,
                expectedStatus: 'ACTIVE',
                ...(note.trim() ? { note: note.trim() } : {})
            });
        } catch {
            setError(true);
            setConfirming(false);
            await data.refetch();
        }
    };
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN]}>
            <Card data-testid="billing-plan-change-screen">
                <CardContent className="space-y-4 pt-6">
                    {result ? (
                        <div
                            role="status"
                            data-testid={`billing-plan-change-${result.outcome}`}
                            className="space-y-2"
                        >
                            {result.outcome === 'SUCCESSION' ? (
                                <>
                                    <p>{t('admin-billing.subscriptionPlanChange.succession')}</p>
                                    <Label htmlFor="plan-change-checkout">
                                        {t('admin-billing.subscriptionPlanChange.checkoutLabel')}
                                    </Label>
                                    <input
                                        id="plan-change-checkout"
                                        readOnly
                                        value={result.checkoutUrl}
                                        className="w-full rounded border p-2"
                                        onFocus={(event) => event.currentTarget.select()}
                                    />
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            if (navigator.clipboard)
                                                void navigator.clipboard
                                                    .writeText(result.checkoutUrl)
                                                    .then(() => setCopied(true));
                                        }}
                                    >
                                        {t('admin-billing.subscriptionPlanChange.copy')}
                                    </Button>
                                    {copied ? (
                                        <p>{t('admin-billing.subscriptionPlanChange.copied')}</p>
                                    ) : null}
                                    <p>
                                        {t('admin-billing.subscriptionPlanChange.firstCharge', {
                                            date: date(result.firstChargeAt)
                                        })}
                                    </p>
                                    <p>
                                        {t('admin-billing.subscriptionPlanChange.creditDays', {
                                            days: result.creditDays
                                        })}
                                    </p>
                                </>
                            ) : result.outcome === 'DOWNGRADE' ? (
                                <p>
                                    {t('admin-billing.subscriptionPlanChange.downgrade', {
                                        date: date(result.effectiveAt)
                                    })}
                                </p>
                            ) : (
                                <p>
                                    {t('admin-billing.subscriptionPlanChange.regret', {
                                        amount: result.amountMinor
                                    })}
                                </p>
                            )}
                        </div>
                    ) : validId ? (
                        data.isLoading ? (
                            <p>{t('admin-billing.subscriptionPlanChange.loading')}</p>
                        ) : data.error ? (
                            <p role="alert">{t('admin-billing.subscriptionPlanChange.error')}</p>
                        ) : inspection?.status === 'ACTIVE' ? (
                            <>
                                <p>
                                    {t('admin-billing.subscriptionPlanChange.customer', {
                                        customer
                                    })}
                                </p>
                                <p>
                                    {t('admin-billing.subscriptionPlanChange.current', {
                                        plan: current
                                    })}
                                </p>
                                {options.length ? (
                                    <>
                                        <Label htmlFor="plan-change-option">
                                            {t('admin-billing.subscriptionPlanChange.destination')}
                                        </Label>
                                        <select
                                            id="plan-change-option"
                                            value={selectedId}
                                            onChange={(event) => {
                                                setSelectedId(event.target.value);
                                                setConfirming(false);
                                            }}
                                            className="w-full rounded border p-2"
                                        >
                                            <option value="">
                                                {t('admin-billing.subscriptionPlanChange.choose')}
                                            </option>
                                            {options.map((option) => (
                                                <option
                                                    key={option.billingOptionId}
                                                    value={option.billingOptionId}
                                                >
                                                    {option.planName} · {option.cycle} ·{' '}
                                                    {new Intl.NumberFormat(locale, {
                                                        style: 'currency',
                                                        currency: option.currency
                                                    }).format(option.amountMinor / 100)}
                                                </option>
                                            ))}
                                        </select>
                                        <Label htmlFor="plan-change-note">
                                            {t('admin-billing.subscriptionPlanChange.note')}
                                        </Label>
                                        <Textarea
                                            id="plan-change-note"
                                            maxLength={2000}
                                            value={note}
                                            onChange={(event) => setNote(event.target.value)}
                                        />
                                        {confirming && selected ? (
                                            <p data-testid="billing-plan-change-confirmation">
                                                {t(
                                                    'admin-billing.subscriptionPlanChange.confirmation',
                                                    {
                                                        customer,
                                                        current,
                                                        destination: selected.planName
                                                    }
                                                )}
                                            </p>
                                        ) : null}
                                        {error ? (
                                            <p role="alert">
                                                {t('admin-billing.subscriptionPlanChange.error')}
                                            </p>
                                        ) : null}
                                        <Button
                                            type="button"
                                            disabled={!selected || action.isPending}
                                            onClick={
                                                confirming
                                                    ? () => void submit()
                                                    : () => setConfirming(true)
                                            }
                                        >
                                            {t(
                                                confirming
                                                    ? 'admin-billing.subscriptionPlanChange.confirm'
                                                    : 'admin-billing.subscriptionPlanChange.review'
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <p>{t('admin-billing.subscriptionPlanChange.noOptions')}</p>
                                )}
                            </>
                        ) : (
                            <p>{t('admin-billing.subscriptionPlanChange.unavailable')}</p>
                        )
                    ) : (
                        <p>{t('admin-billing.subscriptionPlanChange.invalidId')}</p>
                    )}
                </CardContent>
            </Card>
        </PermissionGate>
    );
}

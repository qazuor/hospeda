/**
 * @file LateManualPaymentSection.tsx
 * The manual installments section of the subscription detail (B13a, HOS-1640, owner decisions
 * 1 and 3): it lists the installments in `DECLARED_UNPAID`, opens MP4's read-only confirmation
 * and only then registers the late payment. It lives in the generic subscription view, not in
 * the Partner card, because manual payment exists for any vertical that charges by hand.
 */

import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type RegisterLateManualPaymentRejection } from '@repo/schemas';
import { useId, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import { formatDateWithTime } from '@/lib/format-helpers';
import {
    useDeclaredUnpaidInstallments,
    useLateManualPaymentPreview,
    useRegisterLateManualPayment
} from '../hooks/useLateManualPayment';
import { LateManualPaymentPreview } from './LateManualPaymentPreview';

/** Copy of every MP4 rejection; exhaustive over the shared tuple, so a new code breaks the typecheck. */
const REJECTION_KEYS: Readonly<Record<RegisterLateManualPaymentRejection, TranslationKey>> = {
    SUBSCRIPTION_NOT_FOUND:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.SUBSCRIPTION_NOT_FOUND',
    MANUAL_PAYMENT_NOT_FOUND:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.MANUAL_PAYMENT_NOT_FOUND',
    ADMINISTRATIVE_ACTION_FORBIDDEN:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.ADMINISTRATIVE_ACTION_FORBIDDEN',
    MANUAL_PAYMENT_NOT_MANUAL:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.MANUAL_PAYMENT_NOT_MANUAL',
    MANUAL_PAYMENT_NOT_DECLARED_UNPAID:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.MANUAL_PAYMENT_NOT_DECLARED_UNPAID',
    MANUAL_PAYMENT_NOT_SUSPENDED:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.MANUAL_PAYMENT_NOT_SUSPENDED',
    MANUAL_PAYMENT_CONDITION_FAILED:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.MANUAL_PAYMENT_CONDITION_FAILED',
    MANUAL_PAYMENT_COVERAGE_CONFLICT:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.MANUAL_PAYMENT_COVERAGE_CONFLICT',
    RETAINED_PAYMENT:
        'admin-billing.subscriptionAdmin.lateManualPayment.rejections.RETAINED_PAYMENT',
    LOST_RACE: 'admin-billing.subscriptionAdmin.lateManualPayment.rejections.LOST_RACE'
};

/**
 * Maps an MP4 error to its localized message.
 *
 * @param input - The thrown error.
 * @returns The translation key to show.
 */
export function readLateManualPaymentRejection({
    error
}: {
    readonly error: unknown;
}): TranslationKey {
    const payload = isApiError(error) ? error.body : null;
    const reason = (payload as { error?: { reason?: string } } | null)?.error?.reason;
    if (typeof reason === 'string' && Object.hasOwn(REJECTION_KEYS, reason)) {
        return REJECTION_KEYS[reason as RegisterLateManualPaymentRejection];
    }
    return 'admin-billing.subscriptionAdmin.lateManualPayment.rejections.generic';
}

/**
 * Renders the section for manual-payment subscriptions only, behind MP4's permission and
 * the inspect permission the installment list requires.
 */
export function LateManualPaymentSection({
    subscriptionId,
    paymentMethod
}: {
    readonly subscriptionId: string;
    readonly paymentMethod: 'CARD' | 'MANUAL' | null;
}) {
    if (paymentMethod !== 'MANUAL') return null;
    // The installment list needs inspect and MP4 needs its own permission; both are required.
    return (
        <PermissionGate
            permissions={[
                PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
                PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT
            ]}
            requireAll
        >
            <SectionBody subscriptionId={subscriptionId} />
        </PermissionGate>
    );
}

function SectionBody({ subscriptionId }: { readonly subscriptionId: string }) {
    const { t, locale } = useTranslations();
    const proofId = useId();
    const installments = useDeclaredUnpaidInstallments({ subscriptionId, enabled: true });
    const [selected, setSelected] = useState<string | null>(null);
    const [proofRef, setProofRef] = useState('');
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const preview = useLateManualPaymentPreview({ subscriptionId, manualPaymentId: selected });
    const register = useRegisterLateManualPayment({ subscriptionId });
    const date = (value: string) => formatDateWithTime({ date: value, locale });

    const back = () => {
        setSelected(null);
        setProofRef('');
        setErrorKey(null);
    };
    const confirm = async () => {
        if (!selected) return;
        setErrorKey(null);
        try {
            const trimmed = proofRef.trim();
            const response = await register.mutateAsync({
                manualPaymentId: selected,
                ...(trimmed ? { proofRef: trimmed } : {})
            });
            setResult(
                t(
                    response.effect === 'S19'
                        ? 'admin-billing.subscriptionAdmin.lateManualPayment.resultS19'
                        : 'admin-billing.subscriptionAdmin.lateManualPayment.resultS7',
                    { nextChargeAt: date(response.nextChargeAt) }
                )
            );
            setSelected(null);
            setProofRef('');
        } catch (error) {
            setErrorKey(readLateManualPaymentRejection({ error }));
        }
    };

    return (
        <section
            data-testid="late-manual-payment-section"
            className="space-y-3 rounded-md border p-4"
        >
            <h2 className="font-semibold">
                {t('admin-billing.subscriptionAdmin.lateManualPayment.title')}
            </h2>
            <p className="text-muted-foreground text-sm">
                {t('admin-billing.subscriptionAdmin.lateManualPayment.description')}
            </p>
            {result ? <p role="status">{result}</p> : null}
            {selected ? (
                <div
                    data-testid="late-manual-payment-review"
                    className="space-y-3"
                >
                    {preview.isLoading ? (
                        <p>
                            {t('admin-billing.subscriptionAdmin.lateManualPayment.previewLoading')}
                        </p>
                    ) : preview.isError ? (
                        <p role="alert">
                            {t(readLateManualPaymentRejection({ error: preview.error }))}
                        </p>
                    ) : preview.data ? (
                        <LateManualPaymentPreview
                            preview={preview.data}
                            locale={locale}
                            t={t}
                        />
                    ) : null}
                    <div className="max-w-md space-y-1">
                        <Label htmlFor={proofId}>
                            {t('admin-billing.subscriptionAdmin.lateManualPayment.proofRef')}
                        </Label>
                        <Input
                            id={proofId}
                            value={proofRef}
                            maxLength={500}
                            onChange={(event) => setProofRef(event.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            disabled={
                                !preview.data ||
                                preview.isError ||
                                preview.isFetching ||
                                register.isPending
                            }
                            onClick={() => void confirm()}
                        >
                            {t('admin-billing.subscriptionAdmin.lateManualPayment.confirm')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={back}
                        >
                            {t('admin-billing.subscriptionAdmin.lateManualPayment.back')}
                        </Button>
                    </div>
                </div>
            ) : (
                <InstallmentList
                    query={installments}
                    date={date}
                    t={t}
                    onReview={(id) => {
                        setResult(null);
                        setErrorKey(null);
                        setSelected(id);
                    }}
                />
            )}
            {errorKey ? <p role="alert">{t(errorKey)}</p> : null}
        </section>
    );
}

function InstallmentList({
    query,
    date,
    t,
    onReview
}: {
    readonly query: ReturnType<typeof useDeclaredUnpaidInstallments>;
    readonly date: (value: string) => string;
    readonly t: (key: TranslationKey, params?: Record<string, unknown>) => string;
    readonly onReview: (id: string) => void;
}) {
    if (query.isLoading)
        return <p>{t('admin-billing.subscriptionAdmin.lateManualPayment.loading')}</p>;
    if (query.isError)
        return <p role="alert">{t('admin-billing.subscriptionAdmin.lateManualPayment.error')}</p>;
    const items = query.data ?? [];
    if (items.length === 0)
        return <p>{t('admin-billing.subscriptionAdmin.lateManualPayment.empty')}</p>;
    return (
        <ul className="space-y-2">
            {items.map((item) => (
                <li
                    key={item.id}
                    className="flex items-center justify-between gap-3"
                >
                    <span>
                        {t('admin-billing.subscriptionAdmin.lateManualPayment.installment', {
                            date: date(item.periodStart)
                        })}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => onReview(item.id)}
                    >
                        {t('admin-billing.subscriptionAdmin.lateManualPayment.review')}
                    </Button>
                </li>
            ))}
        </ul>
    );
}

import {
    type PartnerBillingSetupOptionSchema,
    type PartnerBillingSetupPreviewResponse,
    PermissionEnum,
    type PlanPaymentMethod
} from '@repo/schemas';
import { useState } from 'react';
import type { z } from 'zod';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import {
    formatPartnerBillingSetupAmount,
    partnerBillingSetupCycleKey
} from '../hooks/usePartnerBillingSetup';
import { usePartnerManualPayments } from '../hooks/usePartnerManualPayments';
import { PartnerBillingSetupDialog } from './PartnerBillingSetupDialog';

type BillingOption = z.infer<typeof PartnerBillingSetupOptionSchema>;

/** Props for {@link PartnerBillingSetupConfirmation}. AC:V7:17; ACC:6. */
export interface PartnerBillingSetupConfirmationProps {
    /** No-write preview returned for this Partner. AC:V7:17; ACC:6. */
    readonly preview: PartnerBillingSetupPreviewResponse;
    /** Selected sellable billing option. AC:V7:17; ACC:6. */
    readonly option: BillingOption;
    /** Payment method the team chose among those the plan accepts. HOS-2196. */
    readonly method: PlanPaymentMethod;
}

/** Displays the exact action 6 write effect before confirmation. AC:V7:17; ACC:6. */
export function PartnerBillingSetupConfirmation({
    preview,
    option,
    method
}: PartnerBillingSetupConfirmationProps) {
    const { t, locale } = useTranslations();
    return (
        <div
            className="space-y-2 rounded-md border p-3"
            data-testid="partner-billing-setup-confirmation"
        >
            <p>
                {t(
                    method === 'CARD'
                        ? 'admin-entities.partnerBillingSetup.confirmationTitleCard'
                        : 'admin-entities.partnerBillingSetup.confirmationTitle'
                )}
            </p>
            <p>
                {t('admin-entities.partnerBillingSetup.partner')}: {preview.partner.name}
            </p>
            <p>
                {t('admin-entities.partnerBillingSetup.owner')}: {preview.owner.name} ·{' '}
                {preview.owner.email}
            </p>
            <p>
                {t('admin-entities.partnerBillingSetup.planLabel')}: {option.planName} ·{' '}
                {t(partnerBillingSetupCycleKey(option.cycle))}
            </p>
            <p>
                {t('admin-entities.partnerBillingSetup.amount')}:{' '}
                {formatPartnerBillingSetupAmount(option, locale)}
            </p>
            <p>
                {t('admin-entities.partnerBillingSetup.method')}:{' '}
                {t(
                    method === 'CARD'
                        ? 'admin-entities.partnerBillingSetup.card'
                        : 'admin-entities.partnerBillingSetup.manual'
                )}
            </p>
        </div>
    );
}

/** Props for {@link PartnerBillingSetupOptionList}. AC:V7:17; ACC:6. */
export interface PartnerBillingSetupOptionListProps {
    /** Sellable Partner options from the no-write preview. AC:V7:17; ACC:6. */
    readonly options: readonly BillingOption[];
    /** Selected billing option UUID. AC:V7:17; ACC:6. */
    readonly selectedId: string;
    /** Selects an option without writing. AC:V7:17; ACC:6. */
    readonly onSelect: (id: string) => void;
}

/** Lists plan, cycle and amount choices for action 6. AC:V7:17; ACC:6. */
export function PartnerBillingSetupOptionList({
    options,
    selectedId,
    onSelect
}: PartnerBillingSetupOptionListProps) {
    const { t, locale } = useTranslations();
    return (
        <fieldset className="space-y-2">
            <legend className="font-medium">
                {t('admin-entities.partnerBillingSetup.planLabel')}
            </legend>
            {options.map((item) => (
                <label
                    key={item.billingOptionId}
                    className="flex items-center gap-2 rounded-md border p-2"
                >
                    <input
                        type="radio"
                        name="partner-billing-option"
                        value={item.billingOptionId}
                        checked={selectedId === item.billingOptionId}
                        onChange={() => onSelect(item.billingOptionId)}
                    />
                    <span>
                        {item.planName} · {t(partnerBillingSetupCycleKey(item.cycle))} ·{' '}
                        {formatPartnerBillingSetupAmount(item, locale)}
                    </span>
                </label>
            ))}
        </fieldset>
    );
}

/** Props for {@link PartnerBillingSetupCard}. AC:V7:17; ACC:6. */
export interface PartnerBillingSetupCardProps {
    /** Partner UUID. AC:V7:17; ACC:6. */
    readonly partnerId: string;
    readonly ownerUserId?: string | null;
}

/** Shows the action 6 entry point only to users with its dedicated permission. AC:V7:17; ACC:6. */
export function PartnerBillingSetupCard({ partnerId, ownerUserId }: PartnerBillingSetupCardProps) {
    const { t, locale } = useTranslations();
    const [open, setOpen] = useState(false);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const billing = usePartnerManualPayments(partnerId, ownerUserId ?? '');
    const subscription = billing.subscription;
    return (
        <Card data-testid="partner-billing-setup-card">
            <CardHeader>
                <CardTitle className="font-medium text-sm">
                    {t('admin-entities.partnerBillingSetup.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {billing.isLoading ? (
                    <p>{t('admin-entities.partnerBillingSetup.loading')}</p>
                ) : null}
                {billing.isError ? (
                    <p role="alert">{t('admin-entities.partnerBillingSetup.readError')}</p>
                ) : null}
                {billing.isRegisterError ? (
                    <p role="alert">{t('admin-entities.partnerBillingSetup.registerError')}</p>
                ) : null}
                {!billing.isLoading && !billing.isError && subscription ? (
                    <>
                        <p>
                            {subscription.plan?.planName ??
                                t('admin-entities.partnerBillingSetup.configured')}{' '}
                            · {subscription.price?.cycle ?? subscription.cycle} ·{' '}
                            {subscription.status}
                        </p>
                        {subscription.price ? (
                            <p>
                                {(subscription.price.amountMinor / 100).toLocaleString()}{' '}
                                {subscription.price.currency}
                            </p>
                        ) : null}
                        {billing.installments.length ? (
                            billing.installments.map((installment) => (
                                <div
                                    className="space-y-2 rounded-md border p-3"
                                    key={installment.id}
                                >
                                    <p>
                                        {new Intl.DateTimeFormat(locale, {
                                            month: 'long',
                                            year: 'numeric',
                                            timeZone: 'UTC'
                                        }).format(new Date(installment.periodStart))}{' '}
                                        ·{' '}
                                        {subscription.price
                                            ? (
                                                  subscription.price.amountMinor / 100
                                              ).toLocaleString()
                                            : ''}{' '}
                                        {subscription.price?.currency}
                                    </p>
                                    <textarea
                                        aria-label={t(
                                            'admin-entities.partnerBillingSetup.paymentNote'
                                        )}
                                        value={notes[installment.id] ?? ''}
                                        onChange={(event) =>
                                            setNotes((current) => ({
                                                ...current,
                                                [installment.id]: event.target.value
                                            }))
                                        }
                                    />
                                    <PermissionGate
                                        permissions={[
                                            PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT
                                        ]}
                                    >
                                        <Button
                                            type="button"
                                            disabled={billing.register.isPending}
                                            onClick={() =>
                                                billing.register.mutate({
                                                    manualPaymentId: installment.id,
                                                    note: notes[installment.id] || undefined
                                                })
                                            }
                                        >
                                            {t(
                                                'admin-entities.partnerBillingSetup.registerPayment'
                                            )}
                                        </Button>
                                    </PermissionGate>
                                </div>
                            ))
                        ) : (
                            <p>{t('admin-entities.partnerBillingSetup.noOpenInstallments')}</p>
                        )}
                    </>
                ) : null}
                {!billing.isLoading && !billing.isError && !subscription ? (
                    <>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-entities.partnerBillingSetup.state')}
                        </p>
                        <PermissionGate permissions={[PermissionEnum.PARTNER_CONFIGURE_BILLING]}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(true)}
                            >
                                {t('admin-entities.partnerBillingSetup.configure')}
                            </Button>
                            <PartnerBillingSetupDialog
                                partnerId={partnerId}
                                open={open}
                                onOpenChange={setOpen}
                            />
                        </PermissionGate>
                    </>
                ) : null}
            </CardContent>
        </Card>
    );
}

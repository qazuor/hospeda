/**
 * Billing Settings Page
 *
 * Manages system-wide billing configuration: trials, payments, and
 * notifications. The form binds to the FLAT contract served by
 * `GET/PATCH /api/v1/admin/billing/settings` (see apps/api/src/routes/billing/
 * settings.ts). Webhook configuration is env-managed and not part of this
 * surface (SPEC-143 smoke F-ADMIN-SETTINGS).
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    type BillingSettings,
    type UpdateBillingSettingsPayload,
    useBillingSettingsQuery,
    useUpdateBillingSettingsMutation
} from '@/features/billing-settings';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { requireBillingAccess } from '@/lib/billing-access';
import { getFriendlyErrorInfo, reportError } from '@/lib/errors';
import { AlertCircleIcon, LoaderIcon, SaveIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/_authed/billing/settings')({
    beforeLoad: ({ context }) => requireBillingAccess(context),
    component: BillingSettingsPage
});

const DEFAULT_VALUES = {
    ownerTrialDays: 14,
    complexTrialDays: 28,
    trialAutoBlock: true,
    gracePeriodDays: 3,
    currency: 'ARS',
    taxRate: 21,
    maxPaymentRetries: 3,
    retryIntervalHours: 24,
    sendTrialExpiryReminder: true,
    trialExpiryReminderDays: 3,
    sendPaymentFailedNotification: true,
    sendSubscriptionCancelledNotification: true
};

/**
 * Map the API settings payload to the form's value shape, falling back to the
 * defaults for any field the server omits. Used as the dirty-tracking baseline
 * via `form.reset(...)` so the form mounts pristine and only flags dirty on a
 * real user edit (SPEC-143 smoke F-ADMIN-SETTINGS-DIRTY).
 */
function toFormValues(settings: BillingSettings): typeof DEFAULT_VALUES {
    return {
        ownerTrialDays: settings.ownerTrialDays ?? DEFAULT_VALUES.ownerTrialDays,
        complexTrialDays: settings.complexTrialDays ?? DEFAULT_VALUES.complexTrialDays,
        trialAutoBlock: settings.trialAutoBlock ?? DEFAULT_VALUES.trialAutoBlock,
        gracePeriodDays: settings.gracePeriodDays ?? DEFAULT_VALUES.gracePeriodDays,
        currency: settings.currency ?? DEFAULT_VALUES.currency,
        taxRate: settings.taxRate ?? DEFAULT_VALUES.taxRate,
        maxPaymentRetries: settings.maxPaymentRetries ?? DEFAULT_VALUES.maxPaymentRetries,
        retryIntervalHours: settings.retryIntervalHours ?? DEFAULT_VALUES.retryIntervalHours,
        sendTrialExpiryReminder:
            settings.sendTrialExpiryReminder ?? DEFAULT_VALUES.sendTrialExpiryReminder,
        trialExpiryReminderDays:
            settings.trialExpiryReminderDays ?? DEFAULT_VALUES.trialExpiryReminderDays,
        sendPaymentFailedNotification:
            settings.sendPaymentFailedNotification ?? DEFAULT_VALUES.sendPaymentFailedNotification,
        sendSubscriptionCancelledNotification:
            settings.sendSubscriptionCancelledNotification ??
            DEFAULT_VALUES.sendSubscriptionCancelledNotification
    };
}

function BillingSettingsPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();

    const { data: settings, isLoading, error } = useBillingSettingsQuery();
    const updateMutation = useUpdateBillingSettingsMutation();

    const form = useForm({
        defaultValues: DEFAULT_VALUES,
        onSubmit: async ({ value }) => {
            try {
                const payload: UpdateBillingSettingsPayload = value;
                const saved = await updateMutation.mutateAsync(payload);
                // Adopt the persisted values as the new dirty baseline so the
                // form returns to pristine (Save disabled) right after a save.
                form.reset(toFormValues(saved));
                addToast({
                    title: t('admin-billing.settings.toastSavedTitle'),
                    message: t('admin-billing.settings.toastSavedMessage'),
                    variant: 'success'
                });
            } catch (err) {
                addToast({
                    title: t('admin-billing.settings.toastErrorTitle'),
                    message:
                        err instanceof Error
                            ? err.message
                            : t('admin-billing.settings.toastErrorMessage'),
                    variant: 'error'
                });
            }
        }
    });

    // Seed the form once settings load, using the server values as the dirty
    // baseline (reset updates the form's default values). This keeps the form
    // pristine on mount even when server values differ from DEFAULT_VALUES.
    useEffect(() => {
        if (settings) {
            form.reset(toFormValues(settings));
        }
    }, [settings, form]);

    // Report load errors to Sentry once per occurrence.
    useEffect(() => {
        if (error) {
            reportError({
                error,
                source: 'BillingSettingsPage',
                tags: { feature: 'billing', surface: 'settings-load' }
            });
        }
    }, [error]);

    if (isLoading) {
        return (
            <SidebarPageLayout>
                <div className="flex items-center justify-center py-12">
                    <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </SidebarPageLayout>
        );
    }

    if (error) {
        const friendlyError = getFriendlyErrorInfo(error);
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">
                            {t('admin-billing.settings.title')}
                        </h1>
                        <p className="text-muted-foreground">
                            {t('admin-billing.settings.description')}
                        </p>
                    </div>

                    <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="py-8">
                            <div className="flex items-start gap-3">
                                <AlertCircleIcon className="mt-0.5 h-5 w-5 text-destructive" />
                                <div>
                                    <p className="font-medium text-destructive">
                                        {friendlyError.title}
                                    </p>
                                    <p className="mt-1 text-destructive text-sm">
                                        {friendlyError.description}
                                    </p>
                                    <p className="mt-2 text-destructive text-sm">
                                        {t('admin-billing.settings.defaultFallback')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SidebarPageLayout>
        );
    }

    const isApiAvailable = !!settings && !error;

    return (
        <SidebarPageLayout>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                }}
                className="space-y-6"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">
                            {t('admin-billing.settings.title')}
                        </h1>
                        <p className="text-muted-foreground">
                            {t('admin-billing.settings.description')}
                        </p>
                    </div>

                    <form.Subscribe selector={(state) => state.isDirty}>
                        {(isDirty) => (
                            <Button
                                type="submit"
                                disabled={!isDirty || updateMutation.isPending || !isApiAvailable}
                            >
                                {updateMutation.isPending && (
                                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                <SaveIcon className="mr-2 h-4 w-4" />
                                {t('admin-billing.settings.saveChanges')}
                            </Button>
                        )}
                    </form.Subscribe>
                </div>

                {!isApiAvailable && (
                    <Card className="border-warning/30 bg-warning/10">
                        <CardContent className="py-4">
                            <p className="text-foreground text-sm">
                                <strong>{t('admin-billing.settings.noteLabel')}</strong>{' '}
                                {t('admin-billing.settings.apiUnavailable')}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Trial Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.settings.trial.title')}</CardTitle>
                        <CardDescription>
                            {t('admin-billing.settings.trial.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <form.Field name="ownerTrialDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="ownerTrialDays">
                                            {t('admin-billing.settings.trial.ownerDurationLabel')}
                                        </Label>
                                        <Input
                                            id="ownerTrialDays"
                                            type="number"
                                            min={1}
                                            max={90}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.trial.ownerDurationHint')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="complexTrialDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="complexTrialDays">
                                            {t('admin-billing.settings.trial.complexDurationLabel')}
                                        </Label>
                                        <Input
                                            id="complexTrialDays"
                                            type="number"
                                            min={1}
                                            max={90}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.trial.complexDurationHint')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="trialAutoBlock">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="trialAutoBlock">
                                                {t('admin-billing.settings.trial.autoBlockLabel')}
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                {t('admin-billing.settings.trial.autoBlockHint')}
                                            </p>
                                        </div>
                                        <Switch
                                            id="trialAutoBlock"
                                            checked={field.state.value}
                                            onCheckedChange={field.handleChange}
                                        />
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.settings.payment.title')}</CardTitle>
                        <CardDescription>
                            {t('admin-billing.settings.payment.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <form.Field name="gracePeriodDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="gracePeriodDays">
                                            {t('admin-billing.settings.payment.graceLabel')}
                                        </Label>
                                        <Input
                                            id="gracePeriodDays"
                                            type="number"
                                            min={0}
                                            max={30}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.payment.graceHint')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="currency">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="currency">
                                            {t('admin-billing.settings.payment.currencyLabel')}
                                        </Label>
                                        <Input
                                            id="currency"
                                            type="text"
                                            maxLength={3}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(e.target.value.toUpperCase())
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="ARS"
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.payment.currencyHint')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="taxRate">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="taxRate">
                                            {t('admin-billing.settings.payment.taxRateLabel')}
                                        </Label>
                                        <Input
                                            id="taxRate"
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.payment.taxRateHint')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="maxPaymentRetries">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="maxPaymentRetries">
                                            {t('admin-billing.settings.payment.retryLabel')}
                                        </Label>
                                        <Input
                                            id="maxPaymentRetries"
                                            type="number"
                                            min={0}
                                            max={10}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.payment.retryHint')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="retryIntervalHours">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="retryIntervalHours">
                                            {t('admin-billing.settings.payment.intervalLabel')}
                                        </Label>
                                        <Input
                                            id="retryIntervalHours"
                                            type="number"
                                            min={1}
                                            max={168}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.payment.intervalHint')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </CardContent>
                </Card>

                {/* Notification Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.settings.notification.title')}</CardTitle>
                        <CardDescription>
                            {t('admin-billing.settings.notification.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <form.Field name="sendTrialExpiryReminder">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="sendTrialExpiryReminder">
                                                {t(
                                                    'admin-billing.settings.notification.trialReminderLabel'
                                                )}
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                {t(
                                                    'admin-billing.settings.notification.trialReminderHint'
                                                )}
                                            </p>
                                        </div>
                                        <Switch
                                            id="sendTrialExpiryReminder"
                                            checked={field.state.value}
                                            onCheckedChange={field.handleChange}
                                        />
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="trialExpiryReminderDays">
                                {(field) => (
                                    <div className="pl-6">
                                        <Label htmlFor="trialExpiryReminderDays">
                                            {t(
                                                'admin-billing.settings.notification.trialReminderDaysLabel'
                                            )}
                                        </Label>
                                        <Input
                                            id="trialExpiryReminderDays"
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            className="mt-2"
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t(
                                                'admin-billing.settings.notification.trialReminderDaysHint'
                                            )}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="sendPaymentFailedNotification">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="sendPaymentFailedNotification">
                                                {t(
                                                    'admin-billing.settings.notification.paymentFailedLabel'
                                                )}
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                {t(
                                                    'admin-billing.settings.notification.paymentFailedHint'
                                                )}
                                            </p>
                                        </div>
                                        <Switch
                                            id="sendPaymentFailedNotification"
                                            checked={field.state.value}
                                            onCheckedChange={field.handleChange}
                                        />
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="sendSubscriptionCancelledNotification">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="sendSubscriptionCancelledNotification">
                                                {t(
                                                    'admin-billing.settings.notification.subscriptionCancelledLabel'
                                                )}
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                {t(
                                                    'admin-billing.settings.notification.subscriptionCancelledHint'
                                                )}
                                            </p>
                                        </div>
                                        <Switch
                                            id="sendSubscriptionCancelledNotification"
                                            checked={field.state.value}
                                            onCheckedChange={field.handleChange}
                                        />
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer Actions */}
                <div className="flex justify-end gap-4 border-t pt-6">
                    <form.Subscribe selector={(state) => state.isDirty}>
                        {(isDirty) => (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        form.reset(settings ? toFormValues(settings) : undefined);
                                    }}
                                    disabled={!isDirty || updateMutation.isPending}
                                >
                                    {t('admin-billing.settings.discardChanges')}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        !isDirty || updateMutation.isPending || !isApiAvailable
                                    }
                                >
                                    {updateMutation.isPending && (
                                        <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    <SaveIcon className="mr-2 h-4 w-4" />
                                    {t('admin-billing.settings.saveConfig')}
                                </Button>
                            </>
                        )}
                    </form.Subscribe>
                </div>
            </form>
        </SidebarPageLayout>
    );
}

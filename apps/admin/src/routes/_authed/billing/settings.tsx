/**
 * Billing Settings Page
 *
 * Manages system-wide billing configuration including trials, payments,
 * webhooks, and notifications.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    type UpdateBillingSettingsPayload,
    useBillingSettingsQuery,
    useUpdateBillingSettingsMutation
} from '@/features/billing-settings';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/billing/settings')({
    component: BillingSettingsPage
});

function BillingSettingsPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [hasChanges, setHasChanges] = useState(false);

    const { data: settings, isLoading, error } = useBillingSettingsQuery();
    const updateMutation = useUpdateBillingSettingsMutation();

    const form = useForm({
        defaultValues: {
            trial: {
                trialDurationDays: 14,
                autoBlockOnExpiry: true
            },
            payment: {
                gracePeriodDays: 3,
                paymentRetryAttempts: 3,
                retryIntervalHours: 24,
                defaultCurrency: 'ARS'
            },
            notification: {
                sendPaymentReminders: true,
                reminderDaysBeforeDue: 3,
                sendReceiptOnPayment: true
            }
        },
        onSubmit: async ({ value }) => {
            try {
                const payload: UpdateBillingSettingsPayload = value;

                await updateMutation.mutateAsync(payload);

                addToast({
                    title: t('admin-billing.settings.toastSavedTitle'),
                    message: t('admin-billing.settings.toastSavedMessage'),
                    variant: 'success'
                });

                setHasChanges(false);
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

    // Update form when settings are loaded
    useEffect(() => {
        if (settings) {
            form.setFieldValue('trial.trialDurationDays', settings.trial.trialDurationDays);
            form.setFieldValue('trial.autoBlockOnExpiry', settings.trial.autoBlockOnExpiry);
            form.setFieldValue('payment.gracePeriodDays', settings.payment.gracePeriodDays);
            form.setFieldValue(
                'payment.paymentRetryAttempts',
                settings.payment.paymentRetryAttempts
            );
            form.setFieldValue('payment.retryIntervalHours', settings.payment.retryIntervalHours);
            form.setFieldValue('payment.defaultCurrency', settings.payment.defaultCurrency);
            form.setFieldValue(
                'notification.sendPaymentReminders',
                settings.notification.sendPaymentReminders
            );
            form.setFieldValue(
                'notification.reminderDaysBeforeDue',
                settings.notification.reminderDaysBeforeDue
            );
            form.setFieldValue(
                'notification.sendReceiptOnPayment',
                settings.notification.sendReceiptOnPayment
            );
        }
    }, [settings, form]);

    // Track form changes
    useEffect(() => {
        const isDirty = form.state.isDirty;
        if (isDirty !== hasChanges) {
            setHasChanges(isDirty);
        }
    }, [form.state.isDirty, hasChanges]);

    if (isLoading) {
        return (
            <SidebarPageLayout>
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </SidebarPageLayout>
        );
    }

    if (error) {
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">
                            {t('admin-billing.settings.title')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t('admin-billing.settings.description')}
                        </p>
                    </div>

                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="py-8">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                                <div>
                                    <p className="font-medium text-red-900">
                                        {t('admin-billing.settings.loadError')}
                                    </p>
                                    <p className="mt-1 text-red-700 text-sm">{error.message}</p>
                                    <p className="mt-2 text-red-700 text-sm">
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

    const isApiAvailable = settings && !error;

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
                        <h2 className="mb-2 font-bold text-2xl">
                            {t('admin-billing.settings.title')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t('admin-billing.settings.description')}
                        </p>
                    </div>

                    <Button
                        type="submit"
                        disabled={!hasChanges || updateMutation.isPending || !isApiAvailable}
                    >
                        {updateMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Save className="mr-2 h-4 w-4" />
                        {t('admin-billing.settings.saveChanges')}
                    </Button>
                </div>

                {!isApiAvailable && (
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="py-4">
                            <p className="text-sm text-yellow-800">
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
                            <form.Field name="trial.trialDurationDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="trial.trialDurationDays">
                                            {t('admin-billing.settings.trial.durationLabel')}
                                        </Label>
                                        <Input
                                            id="trial.trialDurationDays"
                                            type="number"
                                            min={1}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.trial.durationHint')}
                                        </p>
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="trial.autoBlockOnExpiry">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="trial.autoBlockOnExpiry">
                                                {t('admin-billing.settings.trial.autoBlockLabel')}
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                {t('admin-billing.settings.trial.autoBlockHint')}
                                            </p>
                                        </div>
                                        <Switch
                                            id="trial.autoBlockOnExpiry"
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
                            <form.Field name="payment.gracePeriodDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="payment.gracePeriodDays">
                                            {t('admin-billing.settings.payment.graceLabel')}
                                        </Label>
                                        <Input
                                            id="payment.gracePeriodDays"
                                            type="number"
                                            min={0}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.payment.graceHint')}
                                        </p>
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="payment.paymentRetryAttempts">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="payment.paymentRetryAttempts">
                                            {t('admin-billing.settings.payment.retryLabel')}
                                        </Label>
                                        <Input
                                            id="payment.paymentRetryAttempts"
                                            type="number"
                                            min={1}
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
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="payment.retryIntervalHours">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="payment.retryIntervalHours">
                                            {t('admin-billing.settings.payment.intervalLabel')}
                                        </Label>
                                        <Input
                                            id="payment.retryIntervalHours"
                                            type="number"
                                            min={1}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.payment.intervalHint')}
                                        </p>
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="payment.defaultCurrency">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="payment.defaultCurrency">
                                            {t('admin-billing.settings.payment.currencyLabel')}
                                        </Label>
                                        <Input
                                            id="payment.defaultCurrency"
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
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </CardContent>
                </Card>

                {/* Webhook Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.settings.webhook.title')}</CardTitle>
                        <CardDescription>
                            {t('admin-billing.settings.webhook.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="webhook.webhookUrl">
                                {t('admin-billing.settings.webhook.urlLabel')}
                            </Label>
                            <Input
                                id="webhook.webhookUrl"
                                type="text"
                                value={settings?.webhook.webhookUrl || ''}
                                disabled
                                className="mt-2"
                            />
                            <p className="mt-1 text-muted-foreground text-xs">
                                {t('admin-billing.settings.webhook.readOnly')}
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="webhook.webhookSecret">
                                {t('admin-billing.settings.webhook.secretLabel')}
                            </Label>
                            <Input
                                id="webhook.webhookSecret"
                                type="password"
                                value={settings?.webhook.webhookSecret || ''}
                                disabled
                                className="mt-2"
                            />
                            <p className="mt-1 text-muted-foreground text-xs">
                                {t('admin-billing.settings.webhook.secretHint')}
                            </p>
                        </div>

                        <div>
                            <Label>{t('admin-billing.settings.webhook.lastReceivedLabel')}</Label>
                            <p className="mt-2 text-sm">
                                {settings?.webhook.lastWebhookReceivedAt
                                    ? new Date(
                                          settings.webhook.lastWebhookReceivedAt
                                      ).toLocaleString('es-AR')
                                    : t('admin-billing.settings.webhook.none')}
                            </p>
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
                            <form.Field name="notification.sendPaymentReminders">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="notification.sendPaymentReminders">
                                                {t(
                                                    'admin-billing.settings.notification.remindersLabel'
                                                )}
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                {t(
                                                    'admin-billing.settings.notification.remindersHint'
                                                )}
                                            </p>
                                        </div>
                                        <Switch
                                            id="notification.sendPaymentReminders"
                                            checked={field.state.value}
                                            onCheckedChange={field.handleChange}
                                        />
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="notification.reminderDaysBeforeDue">
                                {(field) => (
                                    <div className="pl-6">
                                        <Label htmlFor="notification.reminderDaysBeforeDue">
                                            {t('admin-billing.settings.notification.daysLabel')}
                                        </Label>
                                        <Input
                                            id="notification.reminderDaysBeforeDue"
                                            type="number"
                                            min={1}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            className="mt-2"
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t('admin-billing.settings.notification.daysHint')}
                                        </p>
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="notification.sendReceiptOnPayment">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="notification.sendReceiptOnPayment">
                                                {t(
                                                    'admin-billing.settings.notification.receiptLabel'
                                                )}
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                {t(
                                                    'admin-billing.settings.notification.receiptHint'
                                                )}
                                            </p>
                                        </div>
                                        <Switch
                                            id="notification.sendReceiptOnPayment"
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
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            form.reset();
                            setHasChanges(false);
                        }}
                        disabled={!hasChanges || updateMutation.isPending}
                    >
                        {t('admin-billing.settings.discardChanges')}
                    </Button>
                    <Button
                        type="submit"
                        disabled={!hasChanges || updateMutation.isPending || !isApiAvailable}
                    >
                        {updateMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Save className="mr-2 h-4 w-4" />
                        {t('admin-billing.settings.saveConfig')}
                    </Button>
                </div>
            </form>
        </SidebarPageLayout>
    );
}

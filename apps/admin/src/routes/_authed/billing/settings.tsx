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
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/billing/settings')({
    component: BillingSettingsPage
});

function BillingSettingsPage() {
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
                    title: 'Configuración guardada',
                    message: 'Los cambios se guardaron correctamente',
                    variant: 'success'
                });

                setHasChanges(false);
            } catch (err) {
                addToast({
                    title: 'Error',
                    message:
                        err instanceof Error ? err.message : 'Error al guardar la configuración',
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
                        <h2 className="mb-2 font-bold text-2xl">Configuración de Facturación</h2>
                        <p className="text-muted-foreground">
                            Configura parámetros y opciones del sistema de facturación
                        </p>
                    </div>

                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="py-8">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                                <div>
                                    <p className="font-medium text-red-900">
                                        Error al cargar la configuración
                                    </p>
                                    <p className="mt-1 text-red-700 text-sm">{error.message}</p>
                                    <p className="mt-2 text-red-700 text-sm">
                                        Mostrando configuración por defecto.
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
                        <h2 className="mb-2 font-bold text-2xl">Configuración de Facturación</h2>
                        <p className="text-muted-foreground">
                            Configura parámetros y opciones del sistema de facturación
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
                        Guardar cambios
                    </Button>
                </div>

                {!isApiAvailable && (
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="py-4">
                            <p className="text-sm text-yellow-800">
                                <strong>Nota:</strong> La API de facturación no está disponible. Los
                                cambios no se guardarán hasta que se implemente el endpoint
                                correspondiente.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Trial Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Períodos de Prueba</CardTitle>
                        <CardDescription>
                            Define la duración y comportamiento de los períodos de prueba
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <form.Field name="trial.trialDurationDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="trial.trialDurationDays">
                                            Duración de Prueba (días)
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
                                            Para planes de Propietario y Complejo
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
                                                Bloqueo Automático
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                Bloquear funciones al vencer el período
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
                        <CardTitle>Configuración de Pagos</CardTitle>
                        <CardDescription>
                            Configura reintentos, períodos de gracia y moneda predeterminada
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <form.Field name="payment.gracePeriodDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="payment.gracePeriodDays">
                                            Período de Gracia (días)
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
                                            Antes de bloquear funcionalidades
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
                                            Reintentos de Pago
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
                                            Número de reintentos automáticos
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
                                            Intervalo de Reintentos (horas)
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
                                            Tiempo entre reintentos de pago
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
                                            Moneda Predeterminada
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
                                            Código de moneda ISO (3 letras)
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
                        <CardTitle>Configuración de Webhooks</CardTitle>
                        <CardDescription>
                            Información sobre la integración de webhooks con Mercado Pago
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="webhook.webhookUrl">Webhook URL</Label>
                            <Input
                                id="webhook.webhookUrl"
                                type="text"
                                value={settings?.webhook.webhookUrl || ''}
                                disabled
                                className="mt-2"
                            />
                            <p className="mt-1 text-muted-foreground text-xs">Solo lectura</p>
                        </div>

                        <div>
                            <Label htmlFor="webhook.webhookSecret">Webhook Secret</Label>
                            <Input
                                id="webhook.webhookSecret"
                                type="password"
                                value={settings?.webhook.webhookSecret || ''}
                                disabled
                                className="mt-2"
                            />
                            <p className="mt-1 text-muted-foreground text-xs">
                                Valor enmascarado por seguridad
                            </p>
                        </div>

                        <div>
                            <Label>Último Webhook Recibido</Label>
                            <p className="mt-2 text-sm">
                                {settings?.webhook.lastWebhookReceivedAt
                                    ? new Date(
                                          settings.webhook.lastWebhookReceivedAt
                                      ).toLocaleString('es-AR')
                                    : 'Ninguno'}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Notification Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Notificaciones</CardTitle>
                        <CardDescription>
                            Configura las notificaciones automáticas del sistema de facturación
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <form.Field name="notification.sendPaymentReminders">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="notification.sendPaymentReminders">
                                                Recordatorios de Pago
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                Enviar recordatorios antes del vencimiento
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
                                            Días de Anticipación
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
                                            Enviar recordatorio X días antes del vencimiento
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
                                                Recibo de Pago
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                Enviar recibo automáticamente al procesar pago
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
                        Descartar cambios
                    </Button>
                    <Button
                        type="submit"
                        disabled={!hasChanges || updateMutation.isPending || !isApiAvailable}
                    >
                        {updateMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Save className="mr-2 h-4 w-4" />
                        Guardar configuración
                    </Button>
                </div>
            </form>
        </SidebarPageLayout>
    );
}

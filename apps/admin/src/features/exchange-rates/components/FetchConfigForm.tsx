/**
 * Fetch Config Form
 *
 * Form for managing exchange rate configuration settings.
 * Uses TanStack Form with controlled inputs.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LoaderIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { ExchangeRateTypeEnum } from '../types';
import type { ExchangeRateConfig, ExchangeRateConfigUpdateInput } from '../types';

interface FetchConfigFormProps {
    config: ExchangeRateConfig | null;
    onSubmit: (payload: ExchangeRateConfigUpdateInput) => Promise<void>;
    isSubmitting?: boolean;
}

export function FetchConfigForm({ config, onSubmit, isSubmitting = false }: FetchConfigFormProps) {
    const { addToast } = useToast();

    const form = useForm({
        defaultValues: {
            defaultRateType:
                (config?.defaultRateType as ExchangeRateTypeEnum) || ExchangeRateTypeEnum.OFICIAL,
            dolarApiFetchIntervalMinutes: config?.dolarApiFetchIntervalMinutes || 15,
            exchangeRateApiFetchIntervalHours: config?.exchangeRateApiFetchIntervalHours || 6,
            showConversionDisclaimer: config?.showConversionDisclaimer ?? true,
            disclaimerText: config?.disclaimerText || '',
            enableAutoFetch: config?.enableAutoFetch ?? true
        },
        onSubmit: async ({ value }) => {
            try {
                // Validate intervals
                if (
                    value.dolarApiFetchIntervalMinutes < 5 ||
                    value.dolarApiFetchIntervalMinutes > 60
                ) {
                    addToast({
                        title: 'Error de validación',
                        message: 'El intervalo de DolarAPI debe estar entre 5 y 60 minutos',
                        variant: 'error'
                    });
                    return;
                }

                if (
                    value.exchangeRateApiFetchIntervalHours < 1 ||
                    value.exchangeRateApiFetchIntervalHours > 24
                ) {
                    addToast({
                        title: 'Error de validación',
                        message: 'El intervalo de ExchangeRate-API debe estar entre 1 y 24 horas',
                        variant: 'error'
                    });
                    return;
                }

                const payload: ExchangeRateConfigUpdateInput = {
                    defaultRateType: value.defaultRateType,
                    dolarApiFetchIntervalMinutes: value.dolarApiFetchIntervalMinutes,
                    exchangeRateApiFetchIntervalHours: value.exchangeRateApiFetchIntervalHours,
                    showConversionDisclaimer: value.showConversionDisclaimer,
                    disclaimerText: value.disclaimerText || null,
                    enableAutoFetch: value.enableAutoFetch
                };

                await onSubmit(payload);

                addToast({
                    title: 'Configuración guardada',
                    message: 'La configuración se actualizó correctamente',
                    variant: 'success'
                });
            } catch (error) {
                addToast({
                    title: 'Error',
                    message:
                        error instanceof Error ? error.message : 'Error al guardar configuración',
                    variant: 'error'
                });
            }
        }
    });

    // Update form when config changes
    useEffect(() => {
        if (config) {
            form.setFieldValue('defaultRateType', config.defaultRateType as ExchangeRateTypeEnum);
            form.setFieldValue('dolarApiFetchIntervalMinutes', config.dolarApiFetchIntervalMinutes);
            form.setFieldValue(
                'exchangeRateApiFetchIntervalHours',
                config.exchangeRateApiFetchIntervalHours
            );
            form.setFieldValue('showConversionDisclaimer', config.showConversionDisclaimer);
            form.setFieldValue('disclaimerText', config.disclaimerText || '');
            form.setFieldValue('enableAutoFetch', config.enableAutoFetch);
        }
    }, [config, form]);

    if (!config) {
        return (
            <div className="rounded-lg border p-6 text-center">
                <p className="text-muted-foreground">Cargando configuración...</p>
            </div>
        );
    }

    const showDisclaimerValue = form.state.values.showConversionDisclaimer;

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            className="space-y-8"
        >
            {/* Default Rate Type */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">Tipo de Tasa por Defecto</h3>
                <form.Field name="defaultRateType">
                    {(field) => (
                        <div>
                            <Label htmlFor="defaultRateType">Tipo de Tasa</Label>
                            <Select
                                value={field.state.value}
                                onValueChange={(value) =>
                                    field.handleChange(value as ExchangeRateTypeEnum)
                                }
                            >
                                <SelectTrigger id="defaultRateType">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="oficial">Oficial</SelectItem>
                                    <SelectItem value="blue">Blue</SelectItem>
                                    <SelectItem value="mep">MEP</SelectItem>
                                    <SelectItem value="ccl">CCL</SelectItem>
                                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                                    <SelectItem value="standard">Standard</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="mt-2 text-muted-foreground text-sm">
                                Tipo de tasa ARS que se usará por defecto en conversiones
                            </p>
                        </div>
                    )}
                </form.Field>
            </div>

            {/* Fetch Intervals */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">Intervalos de Actualización</h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <form.Field name="dolarApiFetchIntervalMinutes">
                        {(field) => (
                            <div>
                                <Label htmlFor="dolarApiFetchIntervalMinutes">
                                    Intervalo DolarAPI (minutos)
                                </Label>
                                <Input
                                    id="dolarApiFetchIntervalMinutes"
                                    type="number"
                                    min={5}
                                    max={60}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(Number(e.target.value))}
                                    onBlur={field.handleBlur}
                                />
                                <p className="mt-2 text-muted-foreground text-sm">
                                    Frecuencia de obtención de tasas ARS (5-60 minutos)
                                </p>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="exchangeRateApiFetchIntervalHours">
                        {(field) => (
                            <div>
                                <Label htmlFor="exchangeRateApiFetchIntervalHours">
                                    Intervalo ExchangeRate-API (horas)
                                </Label>
                                <Input
                                    id="exchangeRateApiFetchIntervalHours"
                                    type="number"
                                    min={1}
                                    max={24}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(Number(e.target.value))}
                                    onBlur={field.handleBlur}
                                />
                                <p className="mt-2 text-muted-foreground text-sm">
                                    Frecuencia de obtención de tasas internacionales (1-24 horas)
                                </p>
                            </div>
                        )}
                    </form.Field>
                </div>
            </div>

            {/* Disclaimer Settings */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">Configuración de Disclaimer</h3>
                <div className="space-y-6">
                    <form.Field name="showConversionDisclaimer">
                        {(field) => (
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label htmlFor="showConversionDisclaimer">
                                        Mostrar Disclaimer
                                    </Label>
                                    <p className="text-muted-foreground text-sm">
                                        Mostrar aviso legal en conversiones de moneda
                                    </p>
                                </div>
                                <Switch
                                    id="showConversionDisclaimer"
                                    checked={field.state.value}
                                    onCheckedChange={field.handleChange}
                                />
                            </div>
                        )}
                    </form.Field>

                    {showDisclaimerValue && (
                        <form.Field name="disclaimerText">
                            {(field) => (
                                <div>
                                    <Label htmlFor="disclaimerText">Texto del Disclaimer</Label>
                                    <Textarea
                                        id="disclaimerText"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder="Las tasas de cambio son indicativas y pueden variar..."
                                        rows={4}
                                    />
                                    <p className="mt-2 text-muted-foreground text-sm">
                                        Texto personalizado que se mostrará en las conversiones
                                    </p>
                                </div>
                            )}
                        </form.Field>
                    )}
                </div>
            </div>

            {/* Auto Fetch Setting */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">Obtención Automática</h3>
                <form.Field name="enableAutoFetch">
                    {(field) => (
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="enableAutoFetch">Habilitar Auto-Fetch</Label>
                                <p className="text-muted-foreground text-sm">
                                    Obtener tasas automáticamente según los intervalos configurados
                                </p>
                            </div>
                            <Switch
                                id="enableAutoFetch"
                                checked={field.state.value}
                                onCheckedChange={field.handleChange}
                            />
                        </div>
                    )}
                </form.Field>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
                <Button
                    type="submit"
                    disabled={isSubmitting}
                >
                    {isSubmitting && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Configuración
                </Button>
            </div>
        </form>
    );
}

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
import { useTranslations } from '@/hooks/use-translations';
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
    const { t } = useTranslations();

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
                        title: t('admin-billing.exchangeRates.fetchConfig.validationError'),
                        message: t('admin-billing.exchangeRates.fetchConfig.validationDolarApi'),
                        variant: 'error'
                    });
                    return;
                }

                if (
                    value.exchangeRateApiFetchIntervalHours < 1 ||
                    value.exchangeRateApiFetchIntervalHours > 24
                ) {
                    addToast({
                        title: t('admin-billing.exchangeRates.fetchConfig.validationError'),
                        message: t(
                            'admin-billing.exchangeRates.fetchConfig.validationExchangeRateApi'
                        ),
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
                    title: t('admin-billing.exchangeRates.fetchConfig.successTitle'),
                    message: t('admin-billing.exchangeRates.fetchConfig.successMessage'),
                    variant: 'success'
                });
            } catch (error) {
                addToast({
                    title: t('admin-billing.exchangeRates.fetchConfig.errorTitle'),
                    message:
                        error instanceof Error
                            ? error.message
                            : t('admin-billing.exchangeRates.fetchConfig.errorMessage'),
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
                <p className="text-muted-foreground">
                    {t('admin-billing.exchangeRates.fetchConfig.loading')}
                </p>
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
                <h3 className="mb-4 font-semibold text-lg">
                    {t('admin-billing.exchangeRates.fetchConfig.sections.defaultRateType')}
                </h3>
                <form.Field name="defaultRateType">
                    {(field) => (
                        <div>
                            <Label htmlFor="defaultRateType">
                                {t(
                                    'admin-billing.exchangeRates.fetchConfig.fields.defaultRateType'
                                )}
                            </Label>
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
                                    <SelectItem value="oficial">
                                        {t('admin-billing.exchangeRates.rateTypes.oficial')}
                                    </SelectItem>
                                    <SelectItem value="blue">
                                        {t('admin-billing.exchangeRates.rateTypes.blue')}
                                    </SelectItem>
                                    <SelectItem value="mep">
                                        {t('admin-billing.exchangeRates.rateTypes.mep')}
                                    </SelectItem>
                                    <SelectItem value="ccl">
                                        {t('admin-billing.exchangeRates.rateTypes.ccl')}
                                    </SelectItem>
                                    <SelectItem value="tarjeta">
                                        {t('admin-billing.exchangeRates.rateTypes.tarjeta')}
                                    </SelectItem>
                                    <SelectItem value="standard">
                                        {t('admin-billing.exchangeRates.rateTypes.standard')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="mt-2 text-muted-foreground text-sm">
                                {t(
                                    'admin-billing.exchangeRates.fetchConfig.fields.defaultRateTypeHint'
                                )}
                            </p>
                        </div>
                    )}
                </form.Field>
            </div>

            {/* Fetch Intervals */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">
                    {t('admin-billing.exchangeRates.fetchConfig.sections.fetchIntervals')}
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                    <form.Field name="dolarApiFetchIntervalMinutes">
                        {(field) => (
                            <div>
                                <Label htmlFor="dolarApiFetchIntervalMinutes">
                                    {t(
                                        'admin-billing.exchangeRates.fetchConfig.fields.dolarApiInterval'
                                    )}
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
                                    {t(
                                        'admin-billing.exchangeRates.fetchConfig.fields.dolarApiIntervalHint'
                                    )}
                                </p>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="exchangeRateApiFetchIntervalHours">
                        {(field) => (
                            <div>
                                <Label htmlFor="exchangeRateApiFetchIntervalHours">
                                    {t(
                                        'admin-billing.exchangeRates.fetchConfig.fields.exchangeRateApiInterval'
                                    )}
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
                                    {t(
                                        'admin-billing.exchangeRates.fetchConfig.fields.exchangeRateApiIntervalHint'
                                    )}
                                </p>
                            </div>
                        )}
                    </form.Field>
                </div>
            </div>

            {/* Disclaimer Settings */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">
                    {t('admin-billing.exchangeRates.fetchConfig.sections.disclaimer')}
                </h3>
                <div className="space-y-6">
                    <form.Field name="showConversionDisclaimer">
                        {(field) => (
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label htmlFor="showConversionDisclaimer">
                                        {t(
                                            'admin-billing.exchangeRates.fetchConfig.fields.showDisclaimer'
                                        )}
                                    </Label>
                                    <p className="text-muted-foreground text-sm">
                                        {t(
                                            'admin-billing.exchangeRates.fetchConfig.fields.showDisclaimerHint'
                                        )}
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
                                    <Label htmlFor="disclaimerText">
                                        {t(
                                            'admin-billing.exchangeRates.fetchConfig.fields.disclaimerText'
                                        )}
                                    </Label>
                                    <Textarea
                                        id="disclaimerText"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder={t(
                                            'admin-common.placeholders.billing.exchangeRateDisclaimer'
                                        )}
                                        rows={4}
                                    />
                                    <p className="mt-2 text-muted-foreground text-sm">
                                        {t(
                                            'admin-billing.exchangeRates.fetchConfig.fields.disclaimerTextHint'
                                        )}
                                    </p>
                                </div>
                            )}
                        </form.Field>
                    )}
                </div>
            </div>

            {/* Auto Fetch Setting */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">
                    {t('admin-billing.exchangeRates.fetchConfig.sections.autoFetch')}
                </h3>
                <form.Field name="enableAutoFetch">
                    {(field) => (
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="enableAutoFetch">
                                    {t(
                                        'admin-billing.exchangeRates.fetchConfig.fields.enableAutoFetch'
                                    )}
                                </Label>
                                <p className="text-muted-foreground text-sm">
                                    {t(
                                        'admin-billing.exchangeRates.fetchConfig.fields.enableAutoFetchHint'
                                    )}
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
                    {t('admin-billing.exchangeRates.fetchConfig.saveButton')}
                </Button>
            </div>
        </form>
    );
}

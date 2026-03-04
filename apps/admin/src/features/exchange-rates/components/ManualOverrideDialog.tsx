/**
 * Manual Override Dialog
 *
 * Modal dialog for creating manual exchange rate overrides.
 * Uses TanStack Form for form management.
 */
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { formatNumber } from '@repo/i18n';
import { LoaderIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '../types';
import type { ExchangeRateCreateInput } from '../types';

interface ManualOverrideDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (payload: ExchangeRateCreateInput) => Promise<void>;
    isSubmitting?: boolean;
}

export function ManualOverrideDialog({
    open,
    onOpenChange,
    onSubmit,
    isSubmitting = false
}: ManualOverrideDialogProps) {
    const { addToast } = useToast();
    const { t, locale } = useTranslations();

    const form = useForm({
        defaultValues: {
            fromCurrency: PriceCurrencyEnum.USD,
            toCurrency: PriceCurrencyEnum.ARS,
            rate: 0,
            rateType: ExchangeRateTypeEnum.OFICIAL,
            expiresAt: '' // ISO datetime-local format
        },
        onSubmit: async ({ value }) => {
            try {
                // Validate rate is positive
                if (value.rate <= 0) {
                    addToast({
                        title: t(
                            'admin-billing.exchangeRates.manualOverrideDialog.validationError'
                        ),
                        message: t(
                            'admin-billing.exchangeRates.manualOverrideDialog.validationRatePositive'
                        ),
                        variant: 'error'
                    });
                    return;
                }

                // Build payload
                const payload: ExchangeRateCreateInput = {
                    fromCurrency: value.fromCurrency,
                    toCurrency: value.toCurrency,
                    rate: value.rate,
                    inverseRate: 1 / value.rate,
                    rateType: value.rateType,
                    source: ExchangeRateSourceEnum.MANUAL,
                    isManualOverride: true,
                    fetchedAt: new Date(),
                    expiresAt: value.expiresAt ? new Date(value.expiresAt) : null
                };

                await onSubmit(payload);

                addToast({
                    title: t('admin-billing.exchangeRates.manualOverrideDialog.successTitle'),
                    message: t('admin-billing.exchangeRates.manualOverrideDialog.successMessage'),
                    variant: 'success'
                });

                onOpenChange(false);
                form.reset();
            } catch (error) {
                addToast({
                    title: t('admin-billing.exchangeRates.manualOverrideDialog.errorTitle'),
                    message:
                        error instanceof Error
                            ? error.message
                            : t('admin-billing.exchangeRates.manualOverrideDialog.errorMessage'),
                    variant: 'error'
                });
            }
        }
    });

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            form.reset();
        }
    }, [open, form]);

    const rateValue = form.state.values.rate;
    const inverseRate =
        rateValue > 0
            ? formatNumber({
                  value: 1 / rateValue,
                  locale,
                  options: { minimumFractionDigits: 6, maximumFractionDigits: 6 }
              })
            : formatNumber({
                  value: 0,
                  locale,
                  options: { minimumFractionDigits: 6, maximumFractionDigits: 6 }
              });

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.exchangeRates.manualOverrideDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.exchangeRates.manualOverrideDialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="space-y-6"
                >
                    {/* Currency Pair */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">
                            {t(
                                'admin-billing.exchangeRates.manualOverrideDialog.sections.currencyPair'
                            )}
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="fromCurrency">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="fromCurrency">
                                            {t(
                                                'admin-billing.exchangeRates.manualOverrideDialog.fields.fromCurrency'
                                            )}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={field.state.value}
                                            onValueChange={(value) =>
                                                field.handleChange(value as PriceCurrencyEnum)
                                            }
                                        >
                                            <SelectTrigger id="fromCurrency">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="USD">USD</SelectItem>
                                                <SelectItem value="ARS">ARS</SelectItem>
                                                <SelectItem value="BRL">BRL</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="toCurrency">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="toCurrency">
                                            {t(
                                                'admin-billing.exchangeRates.manualOverrideDialog.fields.toCurrency'
                                            )}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={field.state.value}
                                            onValueChange={(value) =>
                                                field.handleChange(value as PriceCurrencyEnum)
                                            }
                                        >
                                            <SelectTrigger id="toCurrency">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ARS">ARS</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                                <SelectItem value="BRL">BRL</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* Rate Details */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">
                            {t(
                                'admin-billing.exchangeRates.manualOverrideDialog.sections.rateDetails'
                            )}
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="rate">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="rate">
                                            {t(
                                                'admin-billing.exchangeRates.manualOverrideDialog.fields.rate'
                                            )}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="rate"
                                            type="number"
                                            min={0}
                                            step={0.0001}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="1234.5678"
                                        />
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t(
                                                'admin-billing.exchangeRates.manualOverrideDialog.fields.inverseRateHint'
                                            )}{' '}
                                            {inverseRate}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="rateType">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="rateType">
                                            {t(
                                                'admin-billing.exchangeRates.manualOverrideDialog.fields.rateType'
                                            )}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={field.state.value}
                                            onValueChange={(value) =>
                                                field.handleChange(value as ExchangeRateTypeEnum)
                                            }
                                        >
                                            <SelectTrigger id="rateType">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="oficial">
                                                    {t(
                                                        'admin-billing.exchangeRates.rateTypes.oficial'
                                                    )}
                                                </SelectItem>
                                                <SelectItem value="blue">
                                                    {t(
                                                        'admin-billing.exchangeRates.rateTypes.blue'
                                                    )}
                                                </SelectItem>
                                                <SelectItem value="mep">
                                                    {t('admin-billing.exchangeRates.rateTypes.mep')}
                                                </SelectItem>
                                                <SelectItem value="ccl">
                                                    {t('admin-billing.exchangeRates.rateTypes.ccl')}
                                                </SelectItem>
                                                <SelectItem value="tarjeta">
                                                    {t(
                                                        'admin-billing.exchangeRates.rateTypes.tarjeta'
                                                    )}
                                                </SelectItem>
                                                <SelectItem value="standard">
                                                    {t(
                                                        'admin-billing.exchangeRates.rateTypes.standard'
                                                    )}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>
                        </div>

                        <form.Field name="expiresAt">
                            {(field) => (
                                <div>
                                    <Label htmlFor="expiresAt">
                                        {t(
                                            'admin-billing.exchangeRates.manualOverrideDialog.fields.expiresAt'
                                        )}
                                    </Label>
                                    <Input
                                        id="expiresAt"
                                        type="datetime-local"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                    />
                                    <p className="mt-1 text-muted-foreground text-xs">
                                        {t(
                                            'admin-billing.exchangeRates.manualOverrideDialog.fields.expiresAtHint'
                                        )}
                                    </p>
                                </div>
                            )}
                        </form.Field>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            {t('admin-billing.exchangeRates.manualOverrideDialog.cancelButton')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                            {t('admin-billing.exchangeRates.manualOverrideDialog.createButton')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

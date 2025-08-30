import type { FieldConfig, SelectOption } from '@/components/entity-form/types/field-config.types';
import {
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { useFieldI18n } from '@/lib/utils/i18n-field.utils';
import * as React from 'react';

/**
 * Currency value type
 */
export interface CurrencyValue {
    amount: number | string;
    currency: string;
}

/**
 * Props for CurrencyField component
 */
export interface CurrencyFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: CurrencyValue;
    /** Change handler */
    onChange?: (value: CurrencyValue) => void;
    /** Blur handler */
    onBlur?: () => void;
    /** Focus handler */
    onFocus?: () => void;
    /** Whether the field has an error */
    hasError?: boolean;
    /** Error message to display */
    errorMessage?: string;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Available currencies */
    currencies?: SelectOption[];
}

/**
 * CurrencyField component for currency amount and type selection
 * Handles CURRENCY field type from FieldConfig
 */
export const CurrencyField = React.forwardRef<HTMLInputElement, CurrencyFieldProps>(
    (
        {
            config,
            value = { amount: '', currency: 'USD' },
            onChange,
            onBlur,
            onFocus,
            hasError = false,
            errorMessage,
            disabled = false,
            required = false,
            className,
            currencies = [],
            ...props
        },
        ref
    ) => {
        const { label, description, placeholder, helper } = useFieldI18n(config.id, config.i18n);

        // Get currency specific config
        const currencyConfig =
            config.typeConfig?.type === 'CURRENCY' ? config.typeConfig : undefined;

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        // Default currencies if none provided
        const defaultCurrencies: SelectOption[] = [
            { value: 'USD', label: 'USD ($)', metadata: { symbol: '$' } },
            { value: 'EUR', label: 'EUR (€)', metadata: { symbol: '€' } },
            { value: 'GBP', label: 'GBP (£)', metadata: { symbol: '£' } },
            { value: 'ARS', label: 'ARS ($)', metadata: { symbol: '$' } }
        ];

        const availableCurrencies = currencies.length > 0 ? currencies : defaultCurrencies;
        const allowedCurrencies = currencyConfig?.allowedCurrencies || [];
        const filteredCurrencies =
            allowedCurrencies.length > 0
                ? availableCurrencies.filter((c) => allowedCurrencies.includes(c.value))
                : availableCurrencies;

        const defaultCurrency =
            currencyConfig?.defaultCurrency || filteredCurrencies[0]?.value || 'USD';
        const showCurrencySymbol = currencyConfig?.showCurrencySymbol !== false;
        const precision = currencyConfig?.precision || 2;
        const min = currencyConfig?.min;
        const max = currencyConfig?.max;

        // Get current currency info
        const currentCurrency =
            filteredCurrencies.find((c) => c.value === value.currency) || filteredCurrencies[0];
        const currencySymbol = currentCurrency?.metadata?.symbol || '$';

        const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newAmount = e.target.value;
            onChange?.({
                ...value,
                amount: newAmount
            });
        };

        const handleCurrencyChange = (newCurrency: string) => {
            onChange?.({
                ...value,
                currency: newCurrency
            });
        };

        // Format amount for display
        const formatAmount = (amount: number | string): string => {
            if (amount === '' || amount === null || amount === undefined) return '';
            const numAmount = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
            if (Number.isNaN(numAmount)) return '';
            return numAmount.toFixed(precision);
        };

        const displayAmount =
            typeof value.amount === 'number' ? formatAmount(value.amount) : value.amount;

        return (
            <div className={cn('space-y-2', className)}>
                {/* Label */}
                {label && (
                    <Label
                        htmlFor={fieldId}
                        className={cn(
                            required && 'after:ml-0.5 after:text-destructive after:content-["*"]'
                        )}
                    >
                        {label}
                    </Label>
                )}

                {/* Description */}
                {description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-sm"
                    >
                        {description}
                    </p>
                )}

                {/* Currency Input Group */}
                <div className="flex gap-2">
                    {/* Amount Input */}
                    <div className="relative flex-1">
                        {showCurrencySymbol && (
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <span className="text-muted-foreground text-sm">
                                    {String(currencySymbol)}
                                </span>
                            </div>
                        )}
                        <Input
                            ref={ref}
                            id={fieldId}
                            type="number"
                            value={displayAmount}
                            onChange={handleAmountChange}
                            onBlur={onBlur}
                            onFocus={onFocus}
                            placeholder={placeholder || '0.00'}
                            disabled={disabled}
                            required={required}
                            min={min}
                            max={max}
                            step={1 / 10 ** precision}
                            className={cn(
                                hasError && 'border-destructive focus-visible:ring-destructive',
                                showCurrencySymbol && 'pl-8',
                                config.className
                            )}
                            aria-invalid={hasError}
                            aria-describedby={
                                cn(errorId, descriptionId, helperId).trim() || undefined
                            }
                            {...props}
                        />
                    </div>

                    {/* Currency Select */}
                    <div className="w-32">
                        <Select
                            value={value.currency || defaultCurrency}
                            onValueChange={handleCurrencyChange}
                            disabled={disabled}
                        >
                            <SelectTrigger className={cn(hasError && 'border-destructive')}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredCurrencies.map((currency) => (
                                    <SelectItem
                                        key={currency.value}
                                        value={currency.value}
                                        disabled={currency.disabled}
                                    >
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                const symbol = currency.metadata?.symbol;
                                                if (!symbol) return null;
                                                return (
                                                    <span className="text-muted-foreground">
                                                        {typeof symbol === 'string'
                                                            ? symbol
                                                            : String(symbol)}
                                                    </span>
                                                );
                                            })()}
                                            <span>{currency.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Helper Text */}
                {helper && !hasError && (
                    <p
                        id={helperId}
                        className="text-muted-foreground text-sm"
                    >
                        {helper}
                    </p>
                )}

                {/* Error Message */}
                {hasError && errorMessage && (
                    <p
                        id={errorId}
                        className="text-destructive text-sm"
                    >
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    }
);

CurrencyField.displayName = 'CurrencyField';

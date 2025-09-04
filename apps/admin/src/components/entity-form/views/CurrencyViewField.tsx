import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { CurrencyValue } from '@/components/entity-form/fields/CurrencyField';
import type {
    CurrencyFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Badge, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import * as React from 'react';

/**
 * Props for CurrencyViewField component
 */
export interface CurrencyViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: CurrencyValue;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the label */
    showLabel?: boolean;
    /** Whether to show the description */
    showDescription?: boolean;
    /** Display format */
    format?: 'full' | 'compact' | 'symbol-only';
    /** Whether to show as badge */
    showAsBadge?: boolean;
}

/**
 * CurrencyViewField component for displaying currency values
 * Handles CURRENCY field type in view mode
 */
export const CurrencyViewField = React.forwardRef<HTMLDivElement, CurrencyViewFieldProps>(
    (
        {
            config,
            value,
            className,
            showLabel = true,
            showDescription = false,
            format = 'full',
            showAsBadge = false,
            ...props
        },
        ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;

        // Get currency specific config
        const currencyConfig =
            config.type === FieldTypeEnum.CURRENCY
                ? (config.typeConfig as CurrencyFieldConfig)
                : undefined;

        const fieldId = `view-field-${config.id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;

        const precision = currencyConfig?.precision || 2;
        const showCurrencySymbol = currencyConfig?.showCurrencySymbol !== false;

        // Currency symbols mapping
        const currencySymbols: Record<string, string> = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            ARS: '$',
            BRL: 'R$',
            CAD: 'C$',
            AUD: 'A$',
            CHF: 'Fr',
            CNY: '¥',
            INR: '₹',
            MXN: '$'
        };

        // Currency names mapping
        const currencyNames: Record<string, string> = {
            USD: 'US Dollar',
            EUR: 'Euro',
            GBP: 'British Pound',
            JPY: 'Japanese Yen',
            ARS: 'Argentine Peso',
            BRL: 'Brazilian Real',
            CAD: 'Canadian Dollar',
            AUD: 'Australian Dollar',
            CHF: 'Swiss Franc',
            CNY: 'Chinese Yuan',
            INR: 'Indian Rupee',
            MXN: 'Mexican Peso'
        };

        const formatAmount = (amount: number | string): string => {
            if (amount === '' || amount === null || amount === undefined) return '0';
            const numAmount = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
            if (Number.isNaN(numAmount)) return '0';

            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: precision,
                maximumFractionDigits: precision
            }).format(numAmount);
        };

        const renderValue = () => {
            if (
                !value ||
                value.amount === '' ||
                value.amount === null ||
                value.amount === undefined
            ) {
                return <span className="text-muted-foreground italic">No amount</span>;
            }

            const currency = value.currency || 'USD';
            const symbol = currencySymbols[currency] || currency;
            const currencyName = currencyNames[currency] || currency;
            const formattedAmount = formatAmount(value.amount);

            let displayText: string;

            switch (format) {
                case 'compact':
                    displayText = showCurrencySymbol
                        ? `${symbol}${formattedAmount}`
                        : `${formattedAmount} ${currency}`;
                    break;
                case 'symbol-only':
                    displayText = `${symbol}${formattedAmount}`;
                    break;
                default:
                    displayText = showCurrencySymbol
                        ? `${symbol}${formattedAmount} ${currency}`
                        : `${formattedAmount} ${currencyName}`;
                    break;
            }

            if (showAsBadge) {
                return (
                    <Badge
                        variant="outline"
                        className="font-mono"
                    >
                        {displayText}
                    </Badge>
                );
            }

            return (
                <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-lg">
                        {showCurrencySymbol && symbol !== currency && (
                            <span className="mr-1 text-muted-foreground">{symbol}</span>
                        )}
                        {formattedAmount}
                    </span>

                    {format === 'full' && (
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">{currency}</span>
                            {currency !== currencyName && (
                                <span className="text-muted-foreground text-xs">
                                    {currencyName}
                                </span>
                            )}
                        </div>
                    )}

                    {format === 'compact' && currency !== symbol && (
                        <span className="text-muted-foreground text-sm">{currency}</span>
                    )}
                </div>
            );
        };

        return (
            <div
                ref={ref}
                className={cn('space-y-1', className)}
                {...props}
            >
                {/* Label */}
                {showLabel && label && (
                    <Label className="font-medium text-muted-foreground text-sm">{label}</Label>
                )}

                {/* Description */}
                {showDescription && description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-xs"
                    >
                        {description}
                    </p>
                )}

                {/* Value */}
                <div
                    className={cn('text-sm', config.className)}
                    aria-describedby={descriptionId}
                >
                    {renderValue()}
                </div>
            </div>
        );
    }
);

CurrencyViewField.displayName = 'CurrencyViewField';

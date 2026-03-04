import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { CurrencyValue } from '@/components/entity-form/fields/CurrencyField';
import type {
    CurrencyFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Badge, Label } from '@/components/ui-wrapped';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { formatNumber } from '@repo/i18n';

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
        // Use locale from translations hook
        const { locale, t } = useTranslations();

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

        /**
         * Get localized currency display name using Intl.DisplayNames.
         * Falls back to the currency code if the API is unavailable.
         */
        const getCurrencyName = (code: string): string => {
            try {
                const displayNames = new Intl.DisplayNames([locale], { type: 'currency' });
                return displayNames.of(code) ?? code;
            } catch {
                return code;
            }
        };

        const formatAmount = (amount: number | string): string => {
            if (amount === '' || amount === null || amount === undefined) return '0';
            const numAmount = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
            if (Number.isNaN(numAmount)) return '0';

            return formatNumber({
                value: numAmount,
                locale,
                options: {
                    minimumFractionDigits: precision,
                    maximumFractionDigits: precision
                }
            });
        };

        const renderValue = () => {
            if (
                !value ||
                value.amount === '' ||
                value.amount === null ||
                value.amount === undefined
            ) {
                return (
                    <span className="text-muted-foreground italic">
                        {t('admin-entities.viewFields.currency.noAmount')}
                    </span>
                );
            }

            const currency = value.currency || 'USD';
            const symbol = currencySymbols[currency] || currency;
            const currencyName = getCurrencyName(currency);
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

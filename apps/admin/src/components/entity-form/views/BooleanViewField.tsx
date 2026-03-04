import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Badge, Label } from '@/components/ui-wrapped';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';

import { CheckIcon, CloseIcon } from '@repo/icons';
import * as React from 'react';

/**
 * Props for BooleanViewField component
 */
export interface BooleanViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the label */
    showLabel?: boolean;
    /** Whether to show the description */
    showDescription?: boolean;
    /** Display style */
    variant?: 'badge' | 'icon' | 'text';
}

/**
 * BooleanViewField component for displaying boolean values
 * Handles CHECKBOX and SWITCH field types in view mode
 */
export const BooleanViewField = React.forwardRef<HTMLDivElement, BooleanViewFieldProps>(
    (
        {
            config,
            value = false,
            className,
            showLabel = true,
            showDescription = false,
            variant = 'badge',
            ...props
        },
        ref
    ) => {
        const { t } = useTranslations();

        // Use direct translations from config
        const label = config.label;
        const description = config.description;

        const fieldId = `view-field-${config.id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;

        const renderValue = () => {
            switch (variant) {
                case 'badge':
                    return (
                        <Badge
                            variant={value ? 'default' : 'secondary'}
                            className={cn(
                                'text-xs',
                                value
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-muted text-muted-foreground'
                            )}
                        >
                            {value
                                ? t('admin-entities.viewFields.boolean.yes')
                                : t('admin-entities.viewFields.boolean.no')}
                        </Badge>
                    );

                case 'icon':
                    return (
                        <div className="flex items-center gap-2">
                            {value ? (
                                <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : (
                                <CloseIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span
                                className={cn(
                                    'text-sm',
                                    value
                                        ? 'text-green-700 dark:text-green-300'
                                        : 'text-muted-foreground'
                                )}
                            >
                                {value
                                    ? t('admin-entities.viewFields.boolean.enabled')
                                    : t('admin-entities.viewFields.boolean.disabled')}
                            </span>
                        </div>
                    );

                default:
                    return (
                        <span
                            className={cn(
                                'text-sm',
                                value
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-muted-foreground'
                            )}
                        >
                            {value
                                ? t('admin-entities.viewFields.boolean.true')
                                : t('admin-entities.viewFields.boolean.false')}
                        </span>
                    );
            }
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
                    className={cn(config.className)}
                    aria-describedby={descriptionId}
                >
                    {renderValue()}
                </div>
            </div>
        );
    }
);

BooleanViewField.displayName = 'BooleanViewField';

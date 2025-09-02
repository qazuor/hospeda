import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Badge, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import { Check, X } from 'lucide-react';
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
                                value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            )}
                        >
                            {value ? 'Yes' : 'No'}
                        </Badge>
                    );

                case 'icon':
                    return (
                        <div className="flex items-center gap-2">
                            {value ? (
                                <Check className="h-4 w-4 text-green-600" />
                            ) : (
                                <X className="h-4 w-4 text-gray-400" />
                            )}
                            <span
                                className={cn(
                                    'text-sm',
                                    value ? 'text-green-700' : 'text-gray-500'
                                )}
                            >
                                {value ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    );

                default:
                    return (
                        <span className={cn('text-sm', value ? 'text-green-700' : 'text-gray-500')}>
                            {value ? 'True' : 'False'}
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

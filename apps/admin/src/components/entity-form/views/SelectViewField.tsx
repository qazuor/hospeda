import type { FieldConfig, SelectOption } from '@/components/entity-form/types/field-config.types';
import { Badge, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import * as React from 'react';

/**
 * Props for SelectViewField component
 */
export interface SelectViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: string | string[];
    /** Options for the select */
    options?: SelectOption[];
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the label */
    showLabel?: boolean;
    /** Whether to show the description */
    showDescription?: boolean;
    /** Whether to show as badges for multiple values */
    showAsBadges?: boolean;
}

/**
 * SelectViewField component for displaying select values
 * Handles SELECT field type in view mode
 */
export const SelectViewField = React.forwardRef<HTMLDivElement, SelectViewFieldProps>(
    (
        {
            config,
            value,
            options = [],
            className,
            showLabel = true,
            showDescription = false,
            showAsBadges = false,
            ...props
        },
        ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;

        const fieldId = `view-field-${config.id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;

        // Handle both single and multiple values
        const values = Array.isArray(value) ? value : value ? [value] : [];
        const isMultiple = Array.isArray(value);

        // Find selected options
        const selectedOptions = values
            .map((val) => options.find((option) => option.value === val))
            .filter(Boolean) as SelectOption[];

        const renderValue = () => {
            if (selectedOptions.length === 0) {
                return <span className="text-muted-foreground italic">No selection</span>;
            }

            if (showAsBadges || isMultiple) {
                return (
                    <div className="flex flex-wrap gap-1">
                        {selectedOptions.map((option) => (
                            <Badge
                                key={option.value}
                                variant="secondary"
                                className="text-xs"
                            >
                                {(() => {
                                    const icon = option.metadata?.icon;
                                    if (icon && typeof icon === 'string') {
                                        return (
                                            <>
                                                <span className="mr-1">{icon}</span>
                                                {option.label}
                                            </>
                                        );
                                    }
                                    return option.label;
                                })()}
                            </Badge>
                        ))}
                    </div>
                );
            }

            const option = selectedOptions[0];
            return (
                <div className="flex items-center gap-2">
                    {(() => {
                        const icon = option.metadata?.icon;
                        if (icon && typeof icon === 'string') {
                            return <span className="text-muted-foreground">{icon}</span>;
                        }
                        return null;
                    })()}
                    <span>{option.label}</span>
                    {option.description && (
                        <span className="text-muted-foreground text-xs">
                            ({option.description})
                        </span>
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

SelectViewField.displayName = 'SelectViewField';

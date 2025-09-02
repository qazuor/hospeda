import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import * as React from 'react';

/**
 * Props for TextViewField component
 */
export interface TextViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: string;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the label */
    showLabel?: boolean;
    /** Whether to show the description */
    showDescription?: boolean;
}

/**
 * TextViewField component for displaying text values
 * Handles TEXT field type in view mode
 */
export const TextViewField = React.forwardRef<HTMLDivElement, TextViewFieldProps>(
    (
        { config, value = '', className, showLabel = true, showDescription = false, ...props },
        ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;

        const fieldId = `view-field-${config.id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;

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
                    className={cn(
                        'text-sm',
                        !value && 'text-muted-foreground italic',
                        config.className
                    )}
                    aria-describedby={descriptionId}
                >
                    {value || 'No value'}
                </div>
            </div>
        );
    }
);

TextViewField.displayName = 'TextViewField';

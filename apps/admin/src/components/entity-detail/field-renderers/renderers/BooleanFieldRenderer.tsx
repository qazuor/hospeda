/**
 * @file BooleanFieldRenderer Component
 *
 * Renders boolean fields as switches or checkboxes with proper
 * accessibility and visual feedback.
 */

import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { memo } from 'react';
import type { FieldRendererContext } from '../../types';
import { FieldWrapper } from '../FieldWrapper';

/**
 * Boolean field renderer component
 */
export const BooleanFieldRenderer = memo(
    <TData = unknown>({
        field,
        value,
        onChange,
        onBlur,
        error,
        isLoading,
        isDisabled,
        mode
    }: FieldRendererContext<TData>) => {
        const booleanValue = Boolean(value);

        // View mode rendering
        if (mode === 'view') {
            return (
                <FieldWrapper
                    field={field}
                    error={error}
                >
                    <div
                        className={cn(
                            'flex min-h-[40px] items-center rounded-md border border-input bg-background px-3 py-2',
                            'text-sm'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Icon
                                name={booleanValue ? 'CheckCircle' : 'XCircle'}
                                className={cn(
                                    'h-4 w-4',
                                    booleanValue ? 'text-green-600' : 'text-gray-400'
                                )}
                            />
                            <span className={cn(booleanValue ? 'text-green-600' : 'text-gray-500')}>
                                {booleanValue ? 'Yes' : 'No'}
                            </span>
                        </div>
                    </div>
                </FieldWrapper>
            );
        }

        // Handle toggle
        const handleToggle = () => {
            if (!isDisabled && !isLoading) {
                onChange(!booleanValue);
                onBlur();
            }
        };

        // Edit mode rendering - Switch style
        return (
            <FieldWrapper
                field={field}
                error={error}
            >
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={booleanValue}
                        onClick={handleToggle}
                        disabled={isDisabled || isLoading}
                        className={cn(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                            booleanValue ? 'bg-primary' : 'bg-input',
                            error && 'ring-2 ring-destructive'
                        )}
                        aria-describedby={error ? `${field.name}-error` : undefined}
                    >
                        <span
                            className={cn(
                                'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                                booleanValue ? 'translate-x-6' : 'translate-x-1'
                            )}
                        />
                    </button>

                    <span
                        className={cn(
                            'text-sm',
                            booleanValue ? 'text-primary' : 'text-muted-foreground'
                        )}
                    >
                        {booleanValue ? 'Enabled' : 'Disabled'}
                    </span>

                    {isLoading && (
                        <Icon
                            name="LoaderCircle"
                            className="h-4 w-4 animate-spin text-muted-foreground"
                        />
                    )}
                </div>
            </FieldWrapper>
        );
    }
);

BooleanFieldRenderer.displayName = 'BooleanFieldRenderer';

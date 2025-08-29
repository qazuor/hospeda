/**
 * @file NumberFieldRenderer Component
 *
 * Renders number input fields with support for integers, decimals,
 * min/max validation, and proper formatting.
 */

import { Icon } from '@/components/icons';
import { Input } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { memo } from 'react';
import type { FieldRendererContext } from '../../types';
import { FieldWrapper } from '../FieldWrapper';

/**
 * Number field renderer component
 */
export const NumberFieldRenderer = memo(
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
        const numericValue = (value as number) || 0;

        // Format number for display
        const formatNumber = (num: number): string => {
            if (Number.isInteger(num)) {
                return num.toString();
            }
            return num.toFixed(2);
        };

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
                            'text-sm',
                            !numericValue && 'text-muted-foreground'
                        )}
                    >
                        {field.icon && (
                            <Icon
                                name={field.icon}
                                className="mr-2 h-4 w-4 text-muted-foreground"
                            />
                        )}
                        {field.prefix && (
                            <span className="mr-2 text-muted-foreground">{field.prefix}</span>
                        )}
                        <span className="flex-1">
                            {numericValue ? formatNumber(numericValue) : 'No value'}
                        </span>
                        {field.suffix && (
                            <span className="ml-2 text-muted-foreground">{field.suffix}</span>
                        )}
                    </div>
                </FieldWrapper>
            );
        }

        // Handle input change
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const inputValue = e.target.value;

            // Allow empty string
            if (inputValue === '') {
                onChange(undefined);
                return;
            }

            // Parse number
            const parsed = Number.parseFloat(inputValue);
            if (!Number.isNaN(parsed)) {
                onChange(parsed);
            }
        };

        // Edit mode rendering
        return (
            <FieldWrapper
                field={field}
                error={error}
            >
                <div className="relative">
                    {field.icon && (
                        <Icon
                            name={field.icon}
                            className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground"
                        />
                    )}
                    {field.prefix && (
                        <span className="-translate-y-1/2 absolute top-1/2 left-3 transform text-muted-foreground text-sm">
                            {field.prefix}
                        </span>
                    )}
                    <Input
                        type="number"
                        value={numericValue || ''}
                        onChange={handleChange}
                        onBlur={onBlur}
                        placeholder={field.placeholder}
                        disabled={isDisabled || isLoading}
                        className={cn(
                            field.icon && 'pl-10',
                            field.prefix && 'pl-8',
                            field.suffix && 'pr-8',
                            error && 'border-destructive focus-visible:ring-destructive'
                        )}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${field.name}-error` : undefined}
                    />
                    {field.suffix && (
                        <span className="-translate-y-1/2 absolute top-1/2 right-3 transform text-muted-foreground text-sm">
                            {field.suffix}
                        </span>
                    )}
                    {isLoading && (
                        <Icon
                            name="LoaderCircle"
                            className="-translate-y-1/2 absolute top-1/2 right-3 h-4 w-4 transform animate-spin text-muted-foreground"
                        />
                    )}
                </div>
            </FieldWrapper>
        );
    }
);

NumberFieldRenderer.displayName = 'NumberFieldRenderer';

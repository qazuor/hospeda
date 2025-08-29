/**
 * @file EmailFieldRenderer Component
 *
 * Renders email input fields with validation and mailto links in view mode.
 */

import { Icon } from '@/components/icons';
import { Input } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { memo } from 'react';
import type { FieldRendererContext } from '../../types';
import { FieldWrapper } from '../FieldWrapper';

/**
 * Email field renderer component
 */
export const EmailFieldRenderer = memo(
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
        const emailValue = (value as string) || '';

        // View mode rendering with mailto link
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
                        <Icon
                            name="Mail"
                            className="mr-2 h-4 w-4 text-muted-foreground"
                        />
                        {emailValue ? (
                            <a
                                href={`mailto:${emailValue}`}
                                className="text-primary hover:underline"
                            >
                                {emailValue}
                            </a>
                        ) : (
                            <span className="text-muted-foreground">No email</span>
                        )}
                    </div>
                </FieldWrapper>
            );
        }

        // Edit mode rendering
        return (
            <FieldWrapper
                field={field}
                error={error}
            >
                <div className="relative">
                    <Icon
                        name="Mail"
                        className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground"
                    />
                    <Input
                        type="email"
                        value={emailValue}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={onBlur}
                        placeholder={field.placeholder || 'Enter email address'}
                        disabled={isDisabled || isLoading}
                        className={cn(
                            'pl-10',
                            error && 'border-destructive focus-visible:ring-destructive'
                        )}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${field.name}-error` : undefined}
                    />
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

EmailFieldRenderer.displayName = 'EmailFieldRenderer';

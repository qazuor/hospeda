import { cn } from '@/lib/utils';
import type * as React from 'react';

/**
 * Props for the FieldAffix wrapper component.
 *
 * Wraps an input element with non-editable prefix and/or suffix labels,
 * matching the mockup "affix" pattern (§4.2 of entity-view-edit-redesign.md).
 *
 * @example
 * ```tsx
 * <FieldAffix prefix="+54">
 *   <Input ... />
 * </FieldAffix>
 *
 * <FieldAffix suffix="m²">
 *   <Input ... />
 * </FieldAffix>
 *
 * <FieldAffix prefix="$">
 *   <Input ... />
 * </FieldAffix>
 * ```
 */
export interface FieldAffixProps {
    /** Text or node shown before the input (e.g. "+54", "$", "https://") */
    prefix?: React.ReactNode;
    /** Text or node shown after the input (e.g. "m²", "%", "kg") */
    suffix?: React.ReactNode;
    /** The input element to wrap */
    children: React.ReactNode;
    /** Additional CSS classes for the outer flex container */
    className?: string;
}

/**
 * FieldAffix renders a non-editable prefix or suffix label visually attached
 * to an input widget. The affix has a muted background matching the mockup style.
 *
 * Accessibility: the prefix/suffix are decorative UI chrome, not semantic content;
 * the actual field label and aria-describedby on the input carry the meaning.
 */
export function FieldAffix({ prefix, suffix, children, className }: FieldAffixProps) {
    if (!prefix && !suffix) {
        return <>{children}</>;
    }

    return (
        <div className={cn('flex items-stretch', className)}>
            {prefix && (
                <span
                    className={cn(
                        'flex items-center border border-input border-r-0 bg-muted px-3',
                        'text-muted-foreground text-sm',
                        'rounded-l-md',
                        // When there is also a suffix, the right border is shared with input
                        suffix && 'rounded-r-none'
                    )}
                    aria-hidden="true"
                >
                    {prefix}
                </span>
            )}

            {/* The child input inherits border, and we override its border-radius */}
            <div
                className={cn(
                    'flex-1 [&>*]:w-full',
                    prefix && '[&>*]:rounded-l-none',
                    suffix && '[&>*]:rounded-r-none',
                    // When both prefix and suffix exist, remove all radius from input
                    prefix && suffix && '[&>*]:rounded-none'
                )}
            >
                {children}
            </div>

            {suffix && (
                <span
                    className={cn(
                        'flex items-center border border-input border-l-0 bg-muted px-3',
                        'text-muted-foreground text-sm',
                        'rounded-r-md'
                    )}
                    aria-hidden="true"
                >
                    {suffix}
                </span>
            )}
        </div>
    );
}

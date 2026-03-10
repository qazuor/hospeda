import { forwardRef } from 'react';
import { cn } from './cn.js';

/** Props accepted by the Textarea component. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Shadcn-compatible styled textarea primitive for the feedback package.
 *
 * Mirrors the Input component's visual style with a default minimum height of
 * 80px and vertical resize. Uses the same semantic tokens (`border-input`,
 * `bg-background`, `ring-ring`, `placeholder:text-muted-foreground`).
 *
 * Error state is communicated via `aria-invalid`, which applies
 * `aria-invalid:border-destructive`.
 *
 * @example
 * <Textarea rows={4} placeholder="Describe the issue..." aria-invalid={!!errors.body} />
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
                    'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2',
                    'resize-vertical text-sm shadow-sm transition-colors',
                    'placeholder:text-muted-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'aria-invalid:border-destructive',
                    className
                )}
                {...props}
            />
        );
    }
);

Textarea.displayName = 'Textarea';

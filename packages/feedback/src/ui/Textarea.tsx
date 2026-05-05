import { forwardRef } from 'react';
import './Textarea.css';
import { cn } from './cn.js';

/** Props accepted by the Textarea component. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Styled textarea primitive for the feedback package.
 *
 * Mirrors the Input component's visual style with a default minimum height
 * of 80px and vertical resize. Error state is communicated via `aria-invalid`,
 * which applies `border-color: var(--fb-destructive)`.
 *
 * @example
 * <Textarea rows={4} placeholder="Describe the issue..." aria-invalid={!!errors.body} />
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn('textarea', className)}
                {...props}
            />
        );
    }
);

Textarea.displayName = 'Textarea';

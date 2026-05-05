import { forwardRef } from 'react';
import './Input.css';
import { cn } from './cn.js';

/** Props accepted by the Input component. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Styled input primitive for the feedback package.
 *
 * Error state is signaled via the native `aria-invalid` attribute which
 * applies a red border via the CSS selector `[aria-invalid='true']`.
 * All colors come from CSS custom properties in tokens.css.
 *
 * @example
 * <Input placeholder="Your email" aria-invalid={!!errors.email} />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                ref={ref}
                type={type}
                className={cn('input', className)}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';

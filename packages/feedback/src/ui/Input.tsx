import { forwardRef } from 'react';
import { cn } from './cn.js';

/** Props accepted by the Input component. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Shadcn-compatible styled input primitive for the feedback package.
 *
 * Uses semantic Tailwind tokens (`border-input`, `bg-background`, `ring-ring`,
 * `placeholder:text-muted-foreground`) that resolve via CSS custom properties
 * defined by the host app. Error state is signaled via the native `aria-invalid`
 * attribute, which applies `aria-invalid:border-destructive`.
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
                className={cn(
                    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1',
                    'text-sm shadow-sm transition-colors',
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

Input.displayName = 'Input';

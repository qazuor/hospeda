import { forwardRef } from 'react';
import { cn } from './cn.js';

/** Visual style variant of the button. */
export type ButtonVariant = 'default' | 'secondary' | 'destructive' | 'ghost' | 'outline';

/** Size variant controlling padding and font size. */
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

/** Props accepted by the Button component. */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Visual style variant. Defaults to `'default'`. */
    readonly variant?: ButtonVariant;
    /** Size variant. Defaults to `'default'`. */
    readonly size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
    default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    secondary: 'border border-primary bg-transparent text-primary hover:bg-primary/10',
    destructive: 'bg-destructive text-white shadow-sm hover:bg-destructive/90',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    outline:
        'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground'
};

const sizeClasses: Record<ButtonSize, string> = {
    default: 'h-9 px-4 py-2 text-sm',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8 text-base',
    icon: 'h-9 w-9'
};

/**
 * Shadcn-compatible button primitive for the feedback package.
 *
 * Supports five variants (`default`, `secondary`, `destructive`, `ghost`, `outline`)
 * and four sizes (`default`, `sm`, `lg`, `icon`). Relies on CSS custom properties
 * (`--primary`, `--destructive`, `--border`, etc.) defined by the host app.
 *
 * @example
 * <Button variant="secondary" size="sm" onClick={handleBack}>Back</Button>
 * <Button disabled={isPending}>Submit</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-ring focus-visible:ring-offset-2',
                    'disabled:pointer-events-none disabled:opacity-50',
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

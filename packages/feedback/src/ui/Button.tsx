import { forwardRef } from 'react';
import './Button.css';
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

const variantClassMap: Record<ButtonVariant, string> = {
    default: 'variantDefault',
    secondary: 'variantSecondary',
    destructive: 'variantDestructive',
    ghost: 'variantGhost',
    outline: 'variantOutline'
};

const sizeClassMap: Record<ButtonSize, string> = {
    default: 'sizeDefault',
    sm: 'sizeSm',
    lg: 'sizeLg',
    icon: 'sizeIcon'
};

/**
 * Button primitive for the feedback package.
 *
 * Supports five variants (`default`, `secondary`, `destructive`, `ghost`, `outline`)
 * and four sizes (`default`, `sm`, `lg`, `icon`). All colors come from CSS custom
 * properties defined in tokens.css — no host app CSS framework required.
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
                className={cn('btn', variantClassMap[variant], sizeClassMap[size], className)}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

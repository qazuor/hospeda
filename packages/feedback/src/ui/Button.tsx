import { forwardRef } from 'react';
import styles from './Button.module.css';
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
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    default: styles.variantDefault!,
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    secondary: styles.variantSecondary!,
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    destructive: styles.variantDestructive!,
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    ghost: styles.variantGhost!,
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    outline: styles.variantOutline!
};

const sizeClassMap: Record<ButtonSize, string> = {
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    default: styles.sizeDefault!,
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    sm: styles.sizeSm!,
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    lg: styles.sizeLg!,
    // biome-ignore lint/style/noNonNullAssertion: CSS Module classes are always present when defined
    icon: styles.sizeIcon!
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
                className={cn(styles.btn, variantClassMap[variant], sizeClassMap[size], className)}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

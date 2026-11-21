/**
 * Shared class recipe for Button and LinkButton (HOS-2413 T-004).
 *
 * One recipe so the `<button>` and the `<a>` that looks like a button cannot
 * drift apart.
 *
 * @module components/account/ui/button-class
 */

import styles from './Button.module.css';
import { cx } from './cx';

/** Visual variants. `accent` is reserved for upsell, sumarse and the header «Publicar». */
export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'quiet'
    | 'danger'
    | 'danger-ghost'
    | 'accent';

/** Sizes: `sm` 36px, `md` 40px, `lg` 44px (control-height tokens). */
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Variant to CSS-module class name. */
const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
    primary: styles.primary ?? '',
    secondary: styles.secondary ?? '',
    ghost: styles.ghost ?? '',
    quiet: styles.quiet ?? '',
    danger: styles.danger ?? '',
    'danger-ghost': styles.dangerGhost ?? '',
    accent: styles.accent ?? ''
};

/**
 * Builds the class string of a button-looking element.
 *
 * @param input - Options object.
 * @param input.variant - Visual variant.
 * @param input.size - Size.
 * @param input.fullWidth - Stretch to the container.
 * @param input.iconOnly - Square icon button.
 * @param input.loading - Show the busy state.
 * @param input.className - Extra caller class.
 * @returns The joined class string.
 */
export function buttonClassName({
    variant,
    size,
    fullWidth,
    iconOnly,
    loading,
    className
}: {
    readonly variant: ButtonVariant;
    readonly size: ButtonSize;
    readonly fullWidth?: boolean;
    readonly iconOnly?: boolean;
    readonly loading?: boolean;
    readonly className?: string;
}): string {
    return cx(
        styles.root,
        styles[size],
        VARIANT_CLASS[variant],
        fullWidth && styles.fullWidth,
        iconOnly && styles.iconOnly,
        loading && styles.loading,
        className
    );
}

/** CSS-module classes the Button and LinkButton markup needs. */
export const buttonParts = {
    content: styles.content,
    spinner: styles.spinner
} as const;

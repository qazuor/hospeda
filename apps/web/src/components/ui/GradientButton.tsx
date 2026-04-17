/**
 * @file GradientButton.tsx
 * @description React version of the GradientButton for use in React islands.
 * Uses the same .btn-gradient CSS classes from components.css as the Astro version.
 */

import type { ReactNode } from 'react';

export interface GradientButtonProps {
    readonly label: string;
    readonly as?: 'a' | 'button';
    readonly href?: string;
    readonly variant?: 'primary' | 'accent' | 'outline-primary' | 'outline-accent';
    readonly size?: 'sm' | 'md' | 'lg';
    readonly shape?: 'pill' | 'rounded';
    readonly className?: string;
    readonly onClick?: () => void;
    readonly target?: string;
    readonly rel?: string;
    readonly leadingIcon?: ReactNode;
    readonly trailingIcon?: ReactNode;
    readonly disabled?: boolean;
    readonly type?: 'button' | 'submit' | 'reset';
    /**
     * Arbitrary `aria-*` attributes as a plain record.
     * Keys are used without the `aria-` prefix; it is added automatically.
     * Boolean values are explicitly stringified to `'true'` or `'false'`
     * for consistency with the Astro version (even though JSX accepts booleans
     * for aria-* natively).
     *
     * **Collision rule**: if `'label'` is included here it is silently dropped —
     * the button label is visible text rendered via the `label` prop.
     *
     * @example { busy: isLoading }
     */
    readonly aria?: Record<string, string | boolean>;
}

export function GradientButton({
    label,
    as: Element = 'a',
    href,
    variant = 'accent',
    size = 'md',
    shape = 'pill',
    className,
    onClick,
    target,
    rel,
    leadingIcon,
    trailingIcon,
    disabled,
    type = 'button',
    aria
}: GradientButtonProps) {
    const classes = [
        'btn-gradient',
        `btn-gradient--${variant}`,
        `btn-gradient--${size}`,
        shape === 'rounded' ? 'btn-gradient--shape-rounded' : '',
        className ?? ''
    ]
        .filter(Boolean)
        .join(' ');

    // Build aria-* spread. The 'label' key is dropped — label prop renders visible text.
    const ariaAttrs: Record<string, string> = {};
    if (aria) {
        for (const [key, value] of Object.entries(aria)) {
            if (key === 'label') continue;
            ariaAttrs[`aria-${key}`] = String(value);
        }
    }

    const content = (
        <>
            {leadingIcon && (
                <span
                    className="gradient-btn__icon gradient-btn__icon--leading"
                    aria-hidden="true"
                >
                    {leadingIcon}
                </span>
            )}
            <span className="gradient-btn__label">{label}</span>
            {trailingIcon && (
                <span
                    className="gradient-btn__icon gradient-btn__icon--trailing"
                    aria-hidden="true"
                >
                    {trailingIcon}
                </span>
            )}
        </>
    );

    if (Element === 'button') {
        return (
            <button
                type={type}
                className={classes}
                onClick={onClick}
                disabled={disabled}
                {...ariaAttrs}
            >
                {content}
            </button>
        );
    }

    return (
        <a
            href={href}
            className={classes}
            target={target}
            rel={rel}
            {...ariaAttrs}
        >
            {content}
        </a>
    );
}

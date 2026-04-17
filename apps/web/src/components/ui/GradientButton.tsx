/**
 * @file GradientButton.tsx
 * @description React version of the GradientButton for use in React islands.
 * Uses the same .btn-gradient CSS classes from components.css as the Astro version.
 */

import type { ReactNode } from 'react';

interface GradientButtonProps {
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
    type = 'button'
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
        >
            {content}
        </a>
    );
}

/**
 * @file GradientButtonReact.tsx
 * @description React version of the GradientButton for use in React islands.
 * Uses the same .btn-gradient CSS classes from components.css as the Astro version.
 */

import { Spinner } from '@/components/shared/feedback/Spinner';
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
     * When true the button enters its loading state: it is `disabled`, carries
     * `aria-busy="true"`, renders an inline {@link Spinner} as the leading icon,
     * and (when `loadingLabel` is set) swaps its visible label. Honors the same
     * loading contract as `LoadingButton` in `shared/feedback/`. Only meaningful
     * when `as="button"`. Defaults to `false`.
     */
    readonly loading?: boolean;
    /** Visible label shown while `loading` (already i18n-resolved). */
    readonly loadingLabel?: string;
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
    loading = false,
    loadingLabel,
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
    // `loading` forces aria-busy regardless of any caller-supplied `busy` key.
    const ariaAttrs: Record<string, string> = {};
    if (aria) {
        for (const [key, value] of Object.entries(aria)) {
            if (key === 'label') continue;
            ariaAttrs[`aria-${key}`] = String(value);
        }
    }
    if (loading) {
        ariaAttrs['aria-busy'] = 'true';
    }

    // Leading slot shows a Spinner while loading, otherwise the caller's icon.
    const resolvedLeadingIcon = loading ? <Spinner size="sm" /> : leadingIcon;
    const visibleLabel = loading && loadingLabel ? loadingLabel : label;

    const content = (
        <>
            {resolvedLeadingIcon && (
                <span
                    className="gradient-btn__icon gradient-btn__icon--leading"
                    aria-hidden="true"
                >
                    {resolvedLeadingIcon}
                </span>
            )}
            <span className="gradient-btn__label">{visibleLabel}</span>
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
                disabled={disabled || loading}
                {...ariaAttrs}
            >
                {content}
            </button>
        );
    }

    // When rendered as an anchor, `loading` neutralizes navigation: an anchor
    // cannot be `disabled`, so we drop `href` (a hrefless <a> is not a link)
    // and mark it `aria-disabled` to keep the contract honest.
    return (
        <a
            href={loading ? undefined : href}
            className={classes}
            target={target}
            rel={rel}
            aria-disabled={loading ? 'true' : undefined}
            {...ariaAttrs}
        >
            {content}
        </a>
    );
}

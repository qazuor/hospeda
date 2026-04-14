/**
 * @file GradientButton.tsx
 * @description React version of the GradientButton for use in React islands.
 * Uses the same .btn-gradient CSS classes from components.css as the Astro version.
 */

interface GradientButtonProps {
    /** Button label text. */
    readonly label: string;
    /** HTML element: 'a' (default) or 'button'. */
    readonly as?: 'a' | 'button';
    /** Destination URL. Required when `as` is 'a'. */
    readonly href?: string;
    /**
     * Color variant.
     * - 'primary': solid brand-blue fill.
     * - 'accent': solid orange accent fill (default).
     * - 'outline-primary': transparent with brand-primary border/text, fills on hover.
     * - 'outline-accent': transparent with brand-accent border/text, fills on hover.
     */
    readonly variant?: 'primary' | 'accent' | 'outline-primary' | 'outline-accent';
    /** Size variant controlling padding. Defaults to 'md'. */
    readonly size?: 'sm' | 'md' | 'lg';
    /** Additional CSS class names. */
    readonly className?: string;
    /** Optional click handler (only for button element). */
    readonly onClick?: () => void;
    /** Open link in new tab. */
    readonly target?: string;
    /** Rel attribute for links. */
    readonly rel?: string;
}

const PADDING_MAP = {
    sm: '10px 24px',
    md: '14px 32px',
    lg: '18px 40px'
} as const;

export function GradientButton({
    label,
    as: Element = 'a',
    href,
    variant = 'accent',
    size = 'md',
    className,
    onClick,
    target,
    rel
}: GradientButtonProps) {
    const isOutline = variant === 'outline-primary' || variant === 'outline-accent';

    const solidBackground =
        variant === 'primary'
            ? 'var(--brand-primary)'
            : variant === 'accent'
              ? 'var(--brand-accent)'
              : undefined;

    const classes = [
        'btn-gradient',
        isOutline ? 'btn-gradient--outline' : '',
        variant === 'outline-accent' ? 'btn-gradient--outline-accent' : '',
        className ?? ''
    ]
        .filter(Boolean)
        .join(' ');

    const style = {
        padding: PADDING_MAP[size],
        ...(solidBackground ? { background: solidBackground } : {})
    };

    if (Element === 'button') {
        return (
            <button
                type="button"
                className={classes}
                style={style}
                onClick={onClick}
            >
                {label}
            </button>
        );
    }

    return (
        <a
            href={href}
            className={classes}
            style={style}
            target={target}
            rel={rel}
        >
            {label}
        </a>
    );
}

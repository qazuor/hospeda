import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * StoveIcon icon component
 *
 * @example
 * ```tsx
 * import { StoveIcon } from '@repo/icons';
 *
 * // Basic usage
 * <StoveIcon />
 *
 * // With custom size and color
 * <StoveIcon size="lg" color="#F97316" />
 *
 * // With Tailwind classes
 * <StoveIcon className="text-orange-500 hover:text-orange-600" />
 * ```
 */
export const StoveIcon = ({
    size = 'md',
    color = 'currentColor',
    className = '',
    'aria-label': ariaLabel,
    ...props
}: IconProps) => (
    <svg
        width={typeof size === 'string' ? ICON_SIZES[size] : size}
        height={typeof size === 'string' ? ICON_SIZES[size] : size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label={ariaLabel}
        {...props}
    >
        <title>{ariaLabel || 'Stove'}</title>
        <path d="M2 12h20l-2 8H4l-2-8Z" />
        <path d="M4 8c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v4H4V8Z" />
        <circle
            cx="8"
            cy="10"
            r="2"
        />
        <circle
            cx="16"
            cy="10"
            r="2"
        />
        <path d="M8 6V4" />
        <path d="M16 6V4" />
        <path d="M12 6V2" />
    </svg>
);

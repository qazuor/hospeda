import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CheckInIcon icon component
 *
 * @example
 * ```tsx
 * import { CheckInIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CheckInIcon />
 *
 * // With custom size and color
 * <CheckInIcon size="lg" color="#10B981" />
 *
 * // With Tailwind classes
 * <CheckInIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const CheckInIcon = ({
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
        <title>{ariaLabel || 'Check In'}</title>
        <path d="m15 3 4 4L7 19l-4-4" />
        <path d="m18 5-4-4" />
        <path d="m2 13 6 6" />
        <path d="m9 7 8 8" />
    </svg>
);

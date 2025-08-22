import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CancelledBookingIcon icon component
 *
 * @example
 * ```tsx
 * import { CancelledBookingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CancelledBookingIcon />
 *
 * // With custom size and color
 * <CancelledBookingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CancelledBookingIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const CancelledBookingIcon = ({
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
        <title>{ariaLabel || 'Cancelled Booking'}</title>
        <path d="m18 6-12 12" />
        <path d="m6 6 12 12" />
    </svg>
);

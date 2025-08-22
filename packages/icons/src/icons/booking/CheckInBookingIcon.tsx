import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CheckInBookingIcon icon component
 *
 * @example
 * ```tsx
 * import { CheckInBookingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CheckInBookingIcon />
 *
 * // With custom size and color
 * <CheckInBookingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CheckInBookingIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const CheckInBookingIcon = ({
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
        <title>{ariaLabel || 'Check In Booking'}</title>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10,17 15,12 10,7" />
        <line
            x1="15"
            x2="3"
            y1="12"
            y2="12"
        />
    </svg>
);

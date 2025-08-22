import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AvailableBookingIcon icon component
 *
 * @example
 * ```tsx
 * import { AvailableBookingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AvailableBookingIcon />
 *
 * // With custom size and color
 * <AvailableBookingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AvailableBookingIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const AvailableBookingIcon = ({
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
        <title>{ariaLabel || 'Available Booking'}</title>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
    </svg>
);

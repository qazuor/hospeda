import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ConfirmedBookingIcon icon component
 *
 * @example
 * ```tsx
 * import { ConfirmedBookingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ConfirmedBookingIcon />
 *
 * // With custom size and color
 * <ConfirmedBookingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ConfirmedBookingIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const ConfirmedBookingIcon = ({
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
        <title>{ariaLabel || 'Confirmed Booking'}</title>
        <path d="M20 6 9 17l-5-5" />
    </svg>
);

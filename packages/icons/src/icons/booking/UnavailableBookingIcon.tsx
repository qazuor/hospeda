import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * UnavailableBookingIcon icon component
 *
 * @example
 * ```tsx
 * import { UnavailableBookingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <UnavailableBookingIcon />
 *
 * // With custom size and color
 * <UnavailableBookingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <UnavailableBookingIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const UnavailableBookingIcon = ({
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
        <title>{ariaLabel || 'Unavailable Booking'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
    </svg>
);

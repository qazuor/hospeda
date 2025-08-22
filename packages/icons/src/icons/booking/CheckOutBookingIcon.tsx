import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CheckOutBookingIcon icon component
 *
 * @example
 * ```tsx
 * import { CheckOutBookingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CheckOutBookingIcon />
 *
 * // With custom size and color
 * <CheckOutBookingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CheckOutBookingIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const CheckOutBookingIcon = ({
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
        <title>{ariaLabel || 'Check Out Booking'}</title>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16,17 21,12 16,7" />
        <line
            x1="21"
            x2="9"
            y1="12"
            y2="12"
        />
    </svg>
);

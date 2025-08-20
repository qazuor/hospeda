import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ParkingIcon icon component
 *
 * @example
 * ```tsx
 * import { ParkingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ParkingIcon />
 *
 * // With custom size and color
 * <ParkingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ParkingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ParkingIcon = ({
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
        <title>{ariaLabel || 'Parking'}</title>
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle
            cx="7"
            cy="17"
            r="2"
        />
        <path d="M9 17h6" />
        <circle
            cx="17"
            cy="17"
            r="2"
        />
    </svg>
);

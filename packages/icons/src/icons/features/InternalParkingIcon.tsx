import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * InternalParkingIcon icon component
 *
 * @example
 * ```tsx
 * import { InternalParkingIcon } from '@repo/icons';
 *
 * // Basic usage
 * <InternalParkingIcon />
 *
 * // With custom size and color
 * <InternalParkingIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <InternalParkingIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const InternalParkingIcon = ({
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
        <title>{ariaLabel || 'Internal Parking'}</title>
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18.4 10c-.3-.8-1-1.3-1.9-1.3H7.5c-.9 0-1.6.5-1.9 1.3L3.5 11.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2" />
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

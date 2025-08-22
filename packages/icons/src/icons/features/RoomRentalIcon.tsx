import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RoomRentalIcon icon component
 *
 * @example
 * ```tsx
 * import { RoomRentalIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RoomRentalIcon />
 *
 * // With custom size and color
 * <RoomRentalIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <RoomRentalIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const RoomRentalIcon = ({
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
        <title>{ariaLabel || 'Room Rental'}</title>
        <path d="M14 6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2z" />
        <path d="M15 8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V8z" />
        <path d="M5 8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8z" />
        <path d="M17 16a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2z" />
        <path d="M5 16a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2z" />
    </svg>
);

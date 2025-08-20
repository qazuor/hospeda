import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MapIcon component
 *
 * @example
 * ```tsx
 * import { MapIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MapIcon />
 *
 * // With custom size and color
 * <MapIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MapIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const MapIcon = ({
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
        aria-label={ariaLabel || 'map icon'}
        {...props}
    >
        <title>{ariaLabel || 'Map'}</title>
        <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
        <path d="M15 5.764v15" />
        <path d="M9 3.236v15" />
    </svg>
);

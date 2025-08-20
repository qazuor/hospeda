import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * RoomTvIcon icon component
 *
 * @example
 * ```tsx
 * import { RoomTvIcon } from '@repo/icons';
 *
 * // Basic usage
 * <RoomTvIcon />
 *
 * // With custom size and color
 * <RoomTvIcon size="lg" color="#8B5CF6" />
 *
 * // With Tailwind classes
 * <RoomTvIcon className="text-purple-500 hover:text-purple-600" />
 * ```
 */
export const RoomTvIcon = ({
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
        <title>{ariaLabel || 'Room TV'}</title>
        <rect
            width="20"
            height="14"
            x="2"
            y="3"
            rx="2"
        />
        <line
            x1="8"
            x2="16"
            y1="21"
            y2="21"
        />
        <line
            x1="12"
            x2="12"
            y1="17"
            y2="21"
        />
        <path d="M7 7h10" />
        <path d="M7 11h6" />
    </svg>
);

import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BoardGamesIcon icon component
 *
 * @example
 * ```tsx
 * import { BoardGamesIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BoardGamesIcon />
 *
 * // With custom size and color
 * <BoardGamesIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BoardGamesIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BoardGamesIcon = ({
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
        <title>{ariaLabel || 'Board Games'}</title>
        <rect
            width="18"
            height="18"
            x="3"
            y="3"
            rx="2"
            ry="2"
        />
        <circle
            cx="8"
            cy="8"
            r="1"
        />
        <circle
            cx="16"
            cy="8"
            r="1"
        />
        <circle
            cx="8"
            cy="12"
            r="1"
        />
        <circle
            cx="16"
            cy="12"
            r="1"
        />
        <circle
            cx="8"
            cy="16"
            r="1"
        />
        <circle
            cx="16"
            cy="16"
            r="1"
        />
    </svg>
);

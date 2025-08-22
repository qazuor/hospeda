import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * StatisticsIcon icon component
 *
 * @example
 * ```tsx
 * import { StatisticsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <StatisticsIcon />
 *
 * // With custom size and color
 * <StatisticsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <StatisticsIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const StatisticsIcon = ({
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
        <title>{ariaLabel || 'Statistics'}</title>
        <line
            x1="12"
            x2="12"
            y1="20"
            y2="10"
        />
        <line
            x1="18"
            x2="18"
            y1="20"
            y2="4"
        />
        <line
            x1="6"
            x2="6"
            y1="20"
            y2="16"
        />
    </svg>
);

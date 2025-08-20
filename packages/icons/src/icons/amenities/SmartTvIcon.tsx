import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SmartTvIcon icon component
 *
 * @example
 * ```tsx
 * import { SmartTvIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SmartTvIcon />
 *
 * // With custom size and color
 * <SmartTvIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SmartTvIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SmartTvIcon = ({
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
        <title>{ariaLabel || 'Smart TV'}</title>
        <rect
            width="20"
            height="15"
            x="2"
            y="3"
            rx="2"
            ry="2"
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
        <circle
            cx="12"
            cy="10"
            r="2"
        />
        <path d="m15 7-3 3-3-3" />
    </svg>
);

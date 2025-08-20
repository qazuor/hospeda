import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * DashboardIcon icon component
 *
 * @example
 * ```tsx
 * import { DashboardIcon } from '@repo/icons';
 *
 * // Basic usage
 * <DashboardIcon />
 *
 * // With custom size and color
 * <DashboardIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <DashboardIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const DashboardIcon = ({
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
        <title>{ariaLabel || 'Dashboard'}</title>
        <rect
            width="7"
            height="9"
            x="3"
            y="3"
            rx="1"
        />
        <rect
            width="7"
            height="5"
            x="14"
            y="3"
            rx="1"
        />
        <rect
            width="7"
            height="9"
            x="14"
            y="12"
            rx="1"
        />
        <rect
            width="7"
            height="5"
            x="3"
            y="16"
            rx="1"
        />
    </svg>
);

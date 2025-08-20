import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AnalyticsIcon icon component
 *
 * @example
 * ```tsx
 * import { AnalyticsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AnalyticsIcon />
 *
 * // With custom size and color
 * <AnalyticsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <AnalyticsIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const AnalyticsIcon = ({
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
        <title>{ariaLabel || 'Analytics'}</title>
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M7 16h8" />
        <path d="M7 11h12" />
        <path d="M7 6h3" />
    </svg>
);

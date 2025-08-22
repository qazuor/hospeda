import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MetricsIcon icon component
 *
 * @example
 * ```tsx
 * import { MetricsIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MetricsIcon />
 *
 * // With custom size and color
 * <MetricsIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MetricsIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const MetricsIcon = ({
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
        <title>{ariaLabel || 'Metrics'}</title>
        <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
        <polyline points="16,7 22,7 22,13" />
    </svg>
);

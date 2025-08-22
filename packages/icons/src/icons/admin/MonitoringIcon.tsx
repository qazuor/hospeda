import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * MonitoringIcon icon component
 *
 * @example
 * ```tsx
 * import { MonitoringIcon } from '@repo/icons';
 *
 * // Basic usage
 * <MonitoringIcon />
 *
 * // With custom size and color
 * <MonitoringIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <MonitoringIcon className="text-purple-500 hover:text-purple-600" />
 * ```
 */
export const MonitoringIcon = ({
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
        <title>{ariaLabel || 'Monitoring'}</title>
        <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
);

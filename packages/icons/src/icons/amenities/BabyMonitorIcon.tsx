import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * BabyMonitorIcon icon component
 *
 * @example
 * ```tsx
 * import { BabyMonitorIcon } from '@repo/icons';
 *
 * // Basic usage
 * <BabyMonitorIcon />
 *
 * // With custom size and color
 * <BabyMonitorIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <BabyMonitorIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const BabyMonitorIcon = ({
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
        <title>{ariaLabel || 'Baby Monitor'}</title>
        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
        <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
        <circle
            cx="12"
            cy="12"
            r="2"
        />
        <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
        <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    </svg>
);

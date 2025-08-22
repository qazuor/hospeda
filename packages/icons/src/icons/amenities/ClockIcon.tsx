import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ClockIcon icon component
 *
 * @example
 * ```tsx
 * import { ClockIcon } from '@repo/icons';
 *
 * // Basic usage
 * <ClockIcon />
 *
 * // With custom size and color
 * <ClockIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <ClockIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const ClockIcon = ({
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
        <title>{ariaLabel || 'Clock'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <polyline points="12,6 12,12 16,14" />
    </svg>
);

import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * Reception24hIcon icon component
 *
 * @example
 * ```tsx
 * import { Reception24hIcon } from '@repo/icons';
 *
 * // Basic usage
 * <Reception24hIcon />
 *
 * // With custom size and color
 * <Reception24hIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <Reception24hIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const Reception24hIcon = ({
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
        <title>{ariaLabel || 'Reception 24h'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <polyline points="12,6 12,12 16,14" />
    </svg>
);

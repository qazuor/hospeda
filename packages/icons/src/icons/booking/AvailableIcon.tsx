import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * AvailableIcon icon component
 *
 * @example
 * ```tsx
 * import { AvailableIcon } from '@repo/icons';
 *
 * // Basic usage
 * <AvailableIcon />
 *
 * // With custom size and color
 * <AvailableIcon size="lg" color="#10B981" />
 *
 * // With Tailwind classes
 * <AvailableIcon className="text-green-500 hover:text-green-600" />
 * ```
 */
export const AvailableIcon = ({
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
        <title>{ariaLabel || 'Available'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

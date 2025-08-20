import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * UnavailableIcon icon component
 *
 * @example
 * ```tsx
 * import { UnavailableIcon } from '@repo/icons';
 *
 * // Basic usage
 * <UnavailableIcon />
 *
 * // With custom size and color
 * <UnavailableIcon size="lg" color="#EF4444" />
 *
 * // With Tailwind classes
 * <UnavailableIcon className="text-red-500 hover:text-red-600" />
 * ```
 */
export const UnavailableIcon = ({
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
        <title>{ariaLabel || 'Unavailable'}</title>
        <circle
            cx="12"
            cy="12"
            r="10"
        />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
    </svg>
);

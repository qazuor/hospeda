import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * HuespedesIcon component
 *
 * @example
 * ```tsx
 * import { HuespedesIcon } from '@repo/icons';
 *
 * // Basic usage
 * <HuespedesIcon />
 *
 * // With custom size and color
 * <HuespedesIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <HuespedesIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const HuespedesIcon = ({
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
        aria-label={ariaLabel || 'huespedes icon'}
        {...props}
    >
        <title>{ariaLabel || 'Huespedes'}</title>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path d="M16 3.128a4 4 0 0 1 0 7.744" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <circle
            cx="9"
            cy="7"
            r="4"
        />
    </svg>
);

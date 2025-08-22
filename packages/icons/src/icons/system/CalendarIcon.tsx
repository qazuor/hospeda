import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * CalendarIcon icon component
 *
 * @example
 * ```tsx
 * import { CalendarIcon } from '@repo/icons';
 *
 * // Basic usage
 * <CalendarIcon />
 *
 * // With custom size and color
 * <CalendarIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <CalendarIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const CalendarIcon = ({
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
        <title>{ariaLabel || 'Calendar'}</title>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect
            width="18"
            height="18"
            x="3"
            y="4"
            rx="2"
        />
        <path d="M3 10h18" />
    </svg>
);

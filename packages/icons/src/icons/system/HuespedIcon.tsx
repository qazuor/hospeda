import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * HuespedIcon component
 *
 * @example
 * ```tsx
 * import { HuespedIcon } from '@repo/icons';
 *
 * // Basic usage
 * <HuespedIcon />
 *
 * // With custom size and color
 * <HuespedIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <HuespedIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const HuespedIcon = ({
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
        aria-label={ariaLabel || 'huesped icon'}
        {...props}
    >
        <title>{ariaLabel || 'Huesped'}</title>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle
            cx="12"
            cy="7"
            r="4"
        />
    </svg>
);

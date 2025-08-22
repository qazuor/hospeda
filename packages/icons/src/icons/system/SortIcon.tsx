import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SortIcon icon component
 *
 * @example
 * ```tsx
 * import { SortIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SortIcon />
 *
 * // With custom size and color
 * <SortIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SortIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SortIcon = ({
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
        <title>{ariaLabel || 'Sort'}</title>
        <path d="m3 16 4 4 4-4" />
        <path d="M7 20V4" />
        <path d="m21 8-4-4-4 4" />
        <path d="M17 4v16" />
    </svg>
);

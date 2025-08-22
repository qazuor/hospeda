import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FilterDataIcon icon component
 *
 * @example
 * ```tsx
 * import { FilterDataIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FilterDataIcon />
 *
 * // With custom size and color
 * <FilterDataIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FilterDataIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FilterDataIcon = ({
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
        <title>{ariaLabel || 'Filter Data'}</title>
        <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3" />
    </svg>
);

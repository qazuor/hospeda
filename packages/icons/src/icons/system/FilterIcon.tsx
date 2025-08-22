import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * FilterIcon icon component
 *
 * @example
 * ```tsx
 * import { FilterIcon } from '@repo/icons';
 *
 * // Basic usage
 * <FilterIcon />
 *
 * // With custom size and color
 * <FilterIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <FilterIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const FilterIcon = ({
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
        <title>{ariaLabel || 'Filter'}</title>
        <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3" />
    </svg>
);

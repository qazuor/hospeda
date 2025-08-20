import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * SearchIcon component
 *
 * @example
 * ```tsx
 * import { SearchIcon } from '@repo/icons';
 *
 * // Basic usage
 * <SearchIcon />
 *
 * // With custom size and color
 * <SearchIcon size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <SearchIcon className="text-blue-500 hover:text-blue-600" />
 * ```
 */
export const SearchIcon = ({
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
        aria-label={ariaLabel || 'search icon'}
        {...props}
    >
        <title>{ariaLabel || 'Search'}</title>
        <path d="m21 21-4.34-4.34" />
        <circle
            cx="11"
            cy="11"
            r="8"
        />
    </svg>
);
